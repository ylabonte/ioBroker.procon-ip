"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetStateData = exports.GetStateCategory = void 0;
const get_state_data_object_1 = require("./get-state-data-object");
const get_state_data_sys_info_1 = require("./get-state-data-sys-info");
const relay_data_object_1 = require("./relay-data-object");
var GetStateCategory;
(function (GetStateCategory) {
    GetStateCategory["TIME"] = "time";
    GetStateCategory["ANALOG"] = "analog";
    GetStateCategory["ELECTRODES"] = "electrodes";
    GetStateCategory["TEMPERATURES"] = "temperatures";
    GetStateCategory["RELAYS"] = "relays";
    GetStateCategory["DIGITAL_INPUT"] = "digitalInput";
    GetStateCategory["EXTERNAL_RELAYS"] = "externalRelays";
    GetStateCategory["CANISTER"] = "canister";
    GetStateCategory["CANISTER_CONSUMPTION"] = "canisterConsumptions";
})(GetStateCategory = exports.GetStateCategory || (exports.GetStateCategory = {}));
class GetStateData {
    constructor(rawData) {
        /**
         * Data categories as array of objects.
         *
         * Keys: Name of the category
         * Values: List of csv columns (type: numeric or numeric[2]) for that category. Since we are operating on array,
         *         columns are counted from 0. Arrays are expected to have two numeric values defining a column slice.
         */
        this.categories = {
            time: [0],
            analog: [[1, 5]],
            electrodes: [6, 7],
            temperatures: [[8, 15]],
            relays: [[16, 23]],
            digitalInput: [[24, 27]],
            externalRelays: [[28, 35]],
            canister: [[36, 38]],
            canisterConsumptions: [[39, 41]]
        };
        this.objects = [];
        this.active = [];
        if (rawData === undefined) {
            this.raw = "";
            this.parsed = [[]];
            this.sysInfo = new get_state_data_sys_info_1.GetStateDataSysInfo();
        }
        else {
            // Save raw input string.
            this.raw = rawData;
            // Parse csv into 2-dimensional array of strings.
            this.parsed = this.raw.split(/[\r\n]+/) // split rows
                .map((row) => row.split(/[,]/)) // split columns
                .filter((row) => row.length > 1 || row.length === 1 && row[0].trim().length > 1); // remove blank lines
            // Save common system information.
            this.sysInfo = new get_state_data_sys_info_1.GetStateDataSysInfo(this.parsed);
            this.resolveObjects();
        }
    }
    getCategory(index) {
        for (const category in this.categories) {
            if (this.categories[category].indexOf(index) >= 0) {
                return category;
            }
        }
        return "none";
    }
    getDataObjects(indices, activeOnly = false) {
        return activeOnly ?
            this.objects.filter((obj, idx) => indices.indexOf(idx) >= 0 && this.active.indexOf(idx) >= 0) :
            this.objects.filter((obj, idx) => indices.indexOf(idx) >= 0);
    }
    getDataObject(id) {
        return this.objects[id] ? this.objects[id] : new get_state_data_object_1.GetStateDataObject(id, "", "", "", "", "");
    }
    getDataObjectsByCategory(category, activeOnly = false) {
        return this.getDataObjects(this.categories[category], activeOnly);
    }
    getChlorineDosageControlId() {
        return Math.min(...this.categories.relays) + Number(this.sysInfo.chlorineDosageRelais);
    }
    getPhMinusDosageControlId() {
        return Math.min(...this.categories.relays) + Number(this.sysInfo.phMinusDosageRelais);
    }
    getPhPlusDosageControlId() {
        return Math.min(...this.categories.relays) + Number(this.sysInfo.phPlusDosageRelais);
    }
    getChlorineDosageControl() {
        return new relay_data_object_1.RelayDataObject(this.getDataObject(this.getChlorineDosageControlId()));
    }
    getPhMinusDosageControl() {
        return new relay_data_object_1.RelayDataObject(this.getDataObject(this.getPhMinusDosageControlId()));
    }
    getPhPlusDosageControl() {
        return new relay_data_object_1.RelayDataObject(this.getDataObject(this.getPhPlusDosageControlId()));
    }
    isDosageControl(id) {
        return [
            this.getChlorineDosageControlId(),
            this.getPhMinusDosageControlId(),
            this.getPhPlusDosageControlId()
        ].indexOf(id) >= 0;
    }
    parseCsv(csv) {
        // Save raw input string.
        this.raw = csv;
        // Parse csv into 2-dimensional array of strings.
        this.parsed = csv.split(/[\r\n]+/) // split rows
            .map((row) => row.split(/[,]/)) // split columns
            .filter((row) => row.length > 1 || row.length === 1 && row[0].trim().length > 1); // remove blank lines
        // Save common system information.
        this.sysInfo = new get_state_data_sys_info_1.GetStateDataSysInfo(this.parsed);
        this.resolveObjects();
    }
    resolveObjects() {
        // Iterate data columns.
        this.active.length = 0;
        this.parsed[1].forEach((name, index) => {
            if (this.objects[index] === undefined) {
                // Add object to the objects array.
                this.objects[index] = new get_state_data_object_1.GetStateDataObject(index, name, this.parsed[2][index], this.parsed[3][index], this.parsed[4][index], this.parsed[5][index]);
            }
            else {
                this.objects[index].set(index, name, this.parsed[2][index], this.parsed[3][index], this.parsed[4][index], this.parsed[5][index]);
            }
            if (this.objects[index].active) {
                this.active.push(index);
            }
        });
        this.categorize();
    }
    categorize() {
        Object.keys(this.categories).forEach((category) => {
            let catId = 1;
            this.categories[category] = this.expandSlice(this.categories[category]);
            this.categories[category].forEach((id) => {
                if (this.objects[id] !== undefined) {
                    this.objects[id].categoryId = catId++;
                    this.objects[id].category = category;
                }
            });
        });
    }
    expandSlice(input) {
        const output = new Array();
        input.forEach((def) => {
            if (Number.isInteger(Number(def))) {
                output.push(Number(def));
            }
            if (Array.isArray(def)) {
                def.map((subDef) => Number(subDef));
                for (let i = Number(def[0]); i <= Number(def[1]); i++) {
                    output.push(i);
                }
            }
        });
        return output;
    }
}
exports.GetStateData = GetStateData;
