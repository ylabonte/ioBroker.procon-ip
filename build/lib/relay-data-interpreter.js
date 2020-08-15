"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayDataInterpreter = exports.RelayStateBitMask = void 0;
const get_state_data_1 = require("./get-state-data");
const relay_data_object_1 = require("./relay-data-object");
/**
 * The relay state is a two bit value in decimal representation:
 * - lsb: 0 = off, 1 = on
 * - msb: 0 = auto, 1 = manual
 */
var RelayStateBitMask;
(function (RelayStateBitMask) {
    RelayStateBitMask[RelayStateBitMask["on"] = 1] = "on";
    RelayStateBitMask[RelayStateBitMask["manual"] = 2] = "manual";
    // off = 2,
    // on = 3,
    // autoOff = 0,
    // autoOn = 1
})(RelayStateBitMask = exports.RelayStateBitMask || (exports.RelayStateBitMask = {}));
class RelayDataInterpreter {
    constructor(logger) {
        this.log = logger;
    }
    evaluate(stateData) {
        let relays = stateData.getDataObjectsByCategory(get_state_data_1.GetStateCategory.RELAYS);
        if (stateData.sysInfo.isExtRelaysEnabled()) {
            relays = relays.concat(stateData.getDataObjectsByCategory(get_state_data_1.GetStateCategory.EXTERNAL_RELAYS));
            this.byteState = [65535, 0];
        }
        else {
            this.byteState = [255, 0];
        }
        relays.forEach((data) => {
            const relay = new relay_data_object_1.RelayDataObject(data);
            this.log.debug(JSON.stringify(relay));
            if (this.isAuto(relay)) {
                this.byteState[0] &= ~relay.bitMask;
            }
            if (this.isOn(relay)) {
                this.byteState[1] |= relay.bitMask;
            }
        });
        return this;
    }
    isOn(relay) {
        return (relay.raw & RelayStateBitMask.on) === RelayStateBitMask.on;
    }
    isOff(relay) {
        return !this.isOn(relay);
    }
    isManual(relay) {
        return (relay.raw & RelayStateBitMask.manual) === RelayStateBitMask.manual;
    }
    isAuto(relay) {
        return !this.isManual(relay);
    }
    setOn(relay) {
        this.log.debug(`Relay byte sate: ${JSON.stringify(this.byteState)}`);
        const relayObject = new relay_data_object_1.RelayDataObject(relay);
        this.byteState[0] |= relayObject.bitMask;
        this.byteState[1] |= relayObject.bitMask;
        return this.byteState;
    }
    setOff(relay) {
        this.log.debug(`Relay byte sate: ${JSON.stringify(this.byteState)}`);
        const relayObject = new relay_data_object_1.RelayDataObject(relay);
        this.byteState[0] |= relayObject.bitMask;
        this.byteState[1] &= ~relayObject.bitMask;
        return this.byteState;
    }
    setAuto(relay) {
        this.log.debug(`Relay byte sate: ${JSON.stringify(this.byteState)}`);
        const relayObject = new relay_data_object_1.RelayDataObject(relay);
        this.byteState[0] &= ~relayObject.bitMask;
        this.byteState[1] &= ~relayObject.bitMask;
        return this.byteState;
    }
}
exports.RelayDataInterpreter = RelayDataInterpreter;
