"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class GetStateDataSysInfo {
    constructor(data) {
        if (data) {
            this.setValuesFromArray(data);
        }
    }
    setValuesFromArray(data) {
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
    toArrayOfObjects() {
        const values = new Array();
        Object.keys(this).forEach((attr) => {
            values.push({ key: attr, value: this[attr] });
        });
        return values;
    }
    isChlorineDosageEnabled() {
        return (this.dosageControl & 1) === 1;
    }
    isPhMinusDosageEnabled() {
        return (this.dosageControl & 256) === 256;
    }
    isPhPlusDosageEnabled() {
        return (this.dosageControl & 4096) === 4096;
    }
    isDosageEnabled(object) {
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
    isExtRelaysEnabled() {
        return (this.configOtherEnable & 16) === 16;
    }
}
exports.GetStateDataSysInfo = GetStateDataSysInfo;
