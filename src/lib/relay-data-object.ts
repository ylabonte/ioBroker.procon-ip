import {GetStateDataObject} from "./get-state-data-object";

export class RelayDataObject extends GetStateDataObject {
    public constructor(data: GetStateDataObject) {
        super(data.id, data.label, data.unit, data.offset.toString(), data.gain.toString(), data.raw.toString());
        // Object.keys(data).forEach((key) => { this[key] = data[key]; });
    }

    /**
     * Returns the bit mask for toggling the relay's state for the usrcfg.cgi endpoint.
     * @see UsrcfgCgiService
     */
    public get bitMask(): number {
        return 1 << (this.categoryId - 1);
    }
}
