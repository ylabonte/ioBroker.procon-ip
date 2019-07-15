import {GetStateCategory, GetStateData} from "./get-state-data";
import {RelayDataObject} from "./relay-data-object";
import {GetStateDataObject} from "./get-state-data-object";

/**
 * The relay state is a two bit value in decimal representation:
 * - lsb: 0 = off, 1 = on
 * - msb: 0 = auto, 1 = manual
 */
export enum RelayStateBitMask {
    on = 1,
    manual = 2
    // off = 2,
    // on = 3,
    // autoOff = 0,
    // autoOn = 1
}

export class RelayDataInterpreter {
    public byteState!: [number, number];
    private log: ioBroker.Logger;

    public constructor(logger: ioBroker.Logger) {
        this.log = logger;
    }

    public evaluate(stateData: GetStateData): RelayDataInterpreter {
        const relays = stateData.getDataObjectsByCategory(GetStateCategory.RELAYS);
        this.byteState = [255, 0];
        relays.forEach((data: GetStateDataObject) => {
            this.log.info(JSON.stringify(data));
            const relay = new RelayDataObject(data);
            this.log.info(JSON.stringify(relay));
            if (this.isAuto(relay)) {
                this.byteState[0] &= ~relay.bitMask;
            }
            if (this.isOn(relay)) {
                this.byteState[1] |= relay.bitMask;
            }
        });
        return this;
    }

    public isOn(relay: GetStateDataObject): boolean {
        return (relay.raw & RelayStateBitMask.on) === RelayStateBitMask.on;
    }

    public isOff(relay: GetStateDataObject): boolean {
        return !this.isOn(relay);
    }

    public isManual(relay: GetStateDataObject): boolean {
        return (relay.raw & RelayStateBitMask.manual) === RelayStateBitMask.manual;
    }

    public isAuto(relay: GetStateDataObject): boolean {
        return !this.isManual(relay);
    }

    public setOn(relay: GetStateDataObject): [number, number] {
        this.log.debug(`Relay byte sate: ${JSON.stringify(this.byteState)}`);
        const relayObject = new RelayDataObject(relay);
        this.byteState[0] |= relayObject.bitMask;
        this.byteState[1] |= relayObject.bitMask;

        return this.byteState;
    }

    public setOff(relay: GetStateDataObject): [number, number] {
        this.log.debug(`Relay byte sate: ${JSON.stringify(this.byteState)}`);
        const relayObject = new RelayDataObject(relay);
        this.byteState[0] |= relayObject.bitMask;
        this.byteState[1] &= ~relayObject.bitMask;

        return this.byteState;
    }

    public setAuto(relay: GetStateDataObject): [number, number] {
        this.log.debug(`Relay byte sate: ${JSON.stringify(this.byteState)}`);
        const relayObject = new RelayDataObject(relay);
        this.byteState[0] &= ~relayObject.bitMask;
        this.byteState[1] &= ~relayObject.bitMask;

        return this.byteState;
    }
}
