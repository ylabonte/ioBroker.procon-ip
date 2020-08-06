"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayDataObject = void 0;
const get_state_data_object_1 = require("./get-state-data-object");
const get_state_data_1 = require("./get-state-data");
class RelayDataObject extends get_state_data_object_1.GetStateDataObject {
    constructor(data) {
        super(data.id, data.label, data.unit, data.offset.toString(), data.gain.toString(), data.raw.toString());
        Object.keys(data).forEach((key) => { this[key] = data[key]; });
    }
    /**
     * Returns the bit mask for toggling the relay's state for the usrcfg.cgi endpoint.
     * @see UsrcfgCgiService
     */
    get bitMask() {
        return 0x01 << (this.category === get_state_data_1.GetStateCategory.EXTERNAL_RELAYS ?
            this.categoryId + 7 :
            this.categoryId - 1);
        // return Math.pow(2, this.categoryId - 1);
    }
}
exports.RelayDataObject = RelayDataObject;
