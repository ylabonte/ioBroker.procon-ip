import {GetStateDataObject} from "./get-state-data-object";

export class GetStateDataSysInfo {
    [key: string]: any;

    public time!: string;
    public uptime!: number;
    public version!: string;
    public resetRootCause!: number;
    public ntpFaultState!: number;
    public configOtherEnable!: number;
    public dosageControl!: number;
    public phPlusDosageRelais!: number;
    public phMinusDosageRelais!: number;
    public chlorineDosageRelais!: number;

    public constructor(data?: string[][]) {
        if (data) {
            this.setValuesFromArray(data);
        }
    }

    public setValuesFromArray(data: string[][]) {
        this.version = data[0][1];
        this.uptime = Number(data[0][2]);
        this.resetRootCause = Number(data[0][3]);
        this.ntpFaultState = Number(data[0][4]);
        this.configOtherEnable = Number(data[0][5]);
        this.dosageControl = Number(data[0][6]);
        this.phPlusDosageRelais = Number(data[0][7]);
        this.phMinusDosageRelais = Number(data[0][8]);
        this.chlorineDosageRelais = Number(data[0][9]);
    }

    public toArrayOfObjects(): { key: string; value: string }[] {
        const values = new Array<{ key: string; value: string }>();
        Object.keys(this).forEach((attr: string) => {
            values.push({key: attr, value: this[attr]});
        });

        return values;
    }

    public isChlorineDosageEnabled(): boolean {
        return (this.dosageControl & 1) === 1;
    }

    public isPhMinusDosageEnabled(): boolean {
        return (this.dosageControl & 256) === 256;
    }

    public isPhPlusDosageEnabled(): boolean {
        return (this.dosageControl & 4096) === 4096;
    }

    public isDosageEnabled(object: GetStateDataObject): boolean {
        switch (object.id) {
            case 36:
            case 39:
                return this.isChlorineDosageEnabled();
            case 37:
            case 40:
                return this.isPhMinusDosageEnabled();
            case 38:
            case 41:
                return this.isPhPlusDosageEnabled();
            default:
                return false;
        }
    }
}
