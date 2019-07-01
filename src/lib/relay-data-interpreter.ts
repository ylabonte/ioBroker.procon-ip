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
            const relay = new RelayDataObject(data);
            if (this.isAuto(relay)) {
                this.byteState[0] &= ~relay.bitMask;
            }
            if (this.isOn(relay)) {
                this.byteState[1] |= relay.bitMask;
            }
            // this.log.info(`relay${relay.categoryId} bitMask: ${relay.bitMask}`);
        });
        // this.log.info(`byteState: ${JSON.stringify(this.byteState)}`);
        // this.log.info(`byteState: ${this.byteState.join(",")}`);
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
        console.log(this.byteState);
        const relayObject = new RelayDataObject(relay);
        this.byteState[0] |= relayObject.bitMask;
        this.byteState[1] |= relayObject.bitMask;

        return this.byteState;
    }

    public setOff(relay: GetStateDataObject): [number, number] {
        console.log(this.byteState);
        const relayObject = new RelayDataObject(relay);
        this.byteState[0] |= relayObject.bitMask;
        this.byteState[1] &= ~relayObject.bitMask;

        return this.byteState;
    }

    public setAuto(relay: GetStateDataObject): [number, number] {
        console.log(this.byteState);
        const relayObject = new RelayDataObject(relay);
        this.byteState[0] &= ~relayObject.bitMask;
        this.byteState[1] &= ~relayObject.bitMask;

        return this.byteState;
    }
}
