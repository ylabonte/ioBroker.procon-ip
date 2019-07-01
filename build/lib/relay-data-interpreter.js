"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
        const relays = stateData.getDataObjectsByCategory(get_state_data_1.GetStateCategory.RELAYS);
        this.byteState = [255, 0];
        relays.forEach((data) => {
            const relay = new relay_data_object_1.RelayDataObject(data);
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
        console.log(this.byteState);
        const relayObject = new relay_data_object_1.RelayDataObject(relay);
        this.byteState[0] |= relayObject.bitMask;
        this.byteState[1] |= relayObject.bitMask;
        return this.byteState;
    }
    setOff(relay) {
        console.log(this.byteState);
        const relayObject = new relay_data_object_1.RelayDataObject(relay);
        this.byteState[0] |= relayObject.bitMask;
        this.byteState[1] &= ~relayObject.bitMask;
        return this.byteState;
    }
    setAuto(relay) {
        console.log(this.byteState);
        const relayObject = new relay_data_object_1.RelayDataObject(relay);
        this.byteState[0] &= ~relayObject.bitMask;
        this.byteState[1] &= ~relayObject.bitMask;
        return this.byteState;
    }
}
exports.RelayDataInterpreter = RelayDataInterpreter;
