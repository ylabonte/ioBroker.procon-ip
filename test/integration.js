const path = require('path');
const http = require('node:http');
const crypto = require('node:crypto');
const { expect } = require('chai');
const { tests } = require('@iobroker/testing');

// Mirror js-controller's encrypt(): AES-192-CBC when the secret is 48 hex chars,
// legacy XOR otherwise. `controllerUrl` is an encryptedNative field, so the
// adapter decrypts it on read — the test must therefore store it ENCRYPTED, or
// the adapter sees garbage ("Invalid controller URL").
function encryptLegacy(key, value) {
    let result = '';
    for (let i = 0; i < value.length; i++) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}
function encryptValue(key, value) {
    if (!/^[0-9a-f]{48}$/.test(key)) {
        return encryptLegacy(key, value);
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-192-cbc', Buffer.from(key, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
    return `$/aes-192-cbc:${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

// A real /GetState.csv sample from a ProCon.IP V.1.7.6. The adapter parses this
// into its objects; relay #1 ("Terassenlicht") becomes procon-ip.0.relays.0.*,
// which is the object the H1 test pre-seeds and checks.
const GETSTATE_CSV = [
    'SYSINFO,1.7.6,725474,8,3,4,257,4,4,5',
    'Time,n.a.,n.a.,n.a.,n.a.,CPU Temp,Redox,pH,Pumpe,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,Terassenlicht,Test,Poolbeleuchtung,Gartenlicht,pH minus,Chlor,Bachlauf,Poolpumpe,TASTER1,TASTER2,TASTER3,TASTER4,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,Cl Rest,pH- Rest,pH+ Rest,Cl consumption,pH- consumption,pH+ consumption',
    'h,mV,mV,Bar,ppm,C,mV,pH,C,C,C,C,C,C,C,C,--,--,--,--,--,--,--,--,cm/s,--,--,--,--,--,--,--,--,--,--,--,%,%,%,ml,ml,ml',
    '0,0,0,-0.400,6.00000,147.5,0.0,0.0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
    '1,0.0625,0.0625,0.0000125,0.000156,-0.00468750,0.0625,0.0078125,0.0625,0.0625,0.0625,0.0625,0.0625,0.0625,0.0625,0.0625,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.1,0.1,0.1,1,1,1',
    '818,36662,-44,-44,-44,22895,13079,897,0,0,0,0,0,0,0,0,2,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,613,715,1000,0,0,0',
].join('\n');

// Promisified objects-DB helpers (harness.objects is the raw js-controller client).
const setObject = (harness, id, obj) =>
    new Promise((resolve, reject) => harness.objects.setObject(id, obj, (err) => (err ? reject(err) : resolve())));
const getObject = (harness, id) =>
    new Promise((resolve, reject) => harness.objects.getObject(id, (err, obj) => (err ? reject(err) : resolve(obj))));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll the object until the H1 schema stamp appears (provisioning is async).
async function waitForStamp(harness, id, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const obj = await getObject(harness, id);
        if (obj && obj.native && obj.native.objectSchemaVersion === 1) return obj;
        await delay(400);
    }
    return null;
}

// Point the adapter at the mock (controllerUrl encrypted with the system secret,
// DMX off, fast poll) and start it. Waits only for `alive`; provisioning is then
// awaited via waitForStamp / getObject so a config slip surfaces as an assertion
// rather than a hang.
async function startWithMock(harness, mockUrl) {
    const sysConfig = await getObject(harness, 'system.config');
    const secret = sysConfig.native.secret;
    await harness.changeAdapterConfig('procon-ip', {
        native: {
            controllerUrl: encryptValue(secret, mockUrl),
            basicAuth: false,
            dmxPolling: 'never',
            updateInterval: 1000,
            requestTimeout: 5000,
            errorTolerance: 10,
        },
    });
    await harness.startAdapterAndWait();
}

tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('H1 self-healing on upgrade', (getHarness) => {
            const RELAY_ID = 'procon-ip.0.relays.0.onOff';
            let mockServer;
            let mockUrl;

            before(async function () {
                this.timeout(20000);
                // Mock controller: serves the CSV fixtures so the adapter can bootstrap
                // + heal without a real device.
                mockServer = http.createServer((req, res) => {
                    if (req.url.startsWith('/GetState.csv')) {
                        res.writeHead(200, { 'Content-Type': 'text/csv' });
                        res.end(GETSTATE_CSV);
                    } else if (req.url.startsWith('/GetDmx.csv')) {
                        res.writeHead(200, { 'Content-Type': 'text/csv' });
                        res.end('0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0');
                    } else {
                        res.writeHead(200);
                        res.end('done');
                    }
                });
                await new Promise((r) => mockServer.listen(0, '127.0.0.1', r));
                mockUrl = `http://127.0.0.1:${mockServer.address().port}`;
            });

            after(async () => {
                if (mockServer) await new Promise((r) => mockServer.close(r));
            });

            it('heals structural fields once and preserves custom name + smartName', async function () {
                this.timeout(60000);
                const harness = getHarness();

                // 1) Seed a pre-1.9.0 object: user-customised name + smartName, WRONG
                //    structural fields, and NO schema stamp (as older versions left it).
                await setObject(harness, RELAY_ID, {
                    type: 'state',
                    common: {
                        name: 'Meine Terrasse', // user renamed it
                        smartName: 'Terrassenlicht', // Alexa/Google name
                        role: 'text', // WRONG — must heal to a switch role
                        type: 'string', // WRONG — must heal to boolean
                        read: false,
                        write: false, // WRONG — a switch is writable
                    },
                    native: {}, // no objectSchemaVersion
                });

                // 2)+3) Point the adapter at the mock (encrypted URL) and start it.
                await startWithMock(harness, mockUrl);

                // 4) Wait until H1 has healed the object (stamp present).
                const healed = await waitForStamp(harness, RELAY_ID, 40000);
                expect(healed, 'object was healed (schema stamp present)').to.be.an('object');

                // 5) Structural fields healed to the correct switch shape…
                expect(healed.native.objectSchemaVersion).to.equal(1);
                expect(healed.common.type).to.equal('boolean');
                expect(healed.common.write).to.equal(true);
                expect(healed.common.role).to.match(/^switch/);
                expect(healed.common.role).to.not.equal('text');

                // 6) …while the user's customisations are preserved untouched.
                expect(healed.common.name).to.equal('Meine Terrasse');
                expect(healed.common.smartName).to.equal('Terrassenlicht');
            });

            it('is idempotent: a stamped object is skipped, not re-healed, on restart', async function () {
                this.timeout(60000);
                const harness = getHarness();

                // Seed an already-healed object (stamp present) but with a corrupted
                // structural field. If provisioning correctly skips stamped objects,
                // the corruption survives; if it re-heals, the corruption is fixed.
                await setObject(harness, RELAY_ID, {
                    type: 'state',
                    common: {
                        name: 'Meine Terrasse',
                        smartName: 'Terrassenlicht',
                        role: 'CORRUPTED-BY-TEST', // must NOT be re-healed
                        type: 'boolean',
                        read: true,
                        write: true,
                    },
                    native: { objectSchemaVersion: 1 }, // already at current version
                });

                await startWithMock(harness, mockUrl);
                // Let it complete a couple of poll cycles.
                await delay(4000);

                const obj = await getObject(harness, RELAY_ID);
                expect(obj.common.role, 'stamped object must be skipped, not re-healed').to.equal('CORRUPTED-BY-TEST');
            });
        });
    },
});
