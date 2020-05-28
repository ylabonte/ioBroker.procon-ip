import { GetStateDataObject } from "./get-state-data-object";
import { GetStateDataSysInfo } from "./get-state-data-sys-info";
import { RelayDataObject } from "./relay-data-object";

export enum GetStateCategory {
    TIME = "time",
    ANALOG = "analog",
    ELECTRODES = "electrodes",
    TEMPERATURES = "temperatures",
    RELAYS = "relays",
    DIGITAL_INPUT = "digitalInput",
    EXTERNAL_RELAYS = "externalRelays",
    CANISTER = "canister",
    CANISTER_CONSUMPTION = "canisterConsumptions",
}

export class GetStateData {
    [key: string]: any;

    /**
     * Raw input string
     */
    public raw: string;

    /**
     * Csv input parsed to array
     */
    public parsed: string[][];

    /**
     * SysInfo column data
     */
    public sysInfo: GetStateDataSysInfo;

    /**
     * Actual data objects
     */
    public objects: GetStateDataObject[];

    /**
     * Indices of all objects not labeled with 'n.a.'
     */
    public active: number[];

    /**
     * Data categories as array of objects.
     *
     * Keys: Name of the category
     * Values: List of csv columns (type: numeric or numeric[2]) for that category. Since we are operating on array,
     *         columns are counted from 0. Arrays are expected to have two numeric values defining a column slice.
     */
    public categories: any = {
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

    public constructor(rawData?: string) {
        this.objects = [];
        this.active = [];
        if (rawData === undefined) {
            this.raw = "";
            this.parsed = [[]];
            this.sysInfo = new GetStateDataSysInfo();
        } else {
            // Save raw input string.
            this.raw = rawData;
            // Parse csv into 2-dimensional array of strings.
            this.parsed = this.raw.split(/[\r\n]+/) // split rows
                .map((row) => row.split(/[,]/)) // split columns
                .filter((row) => row.length > 1 || row.length === 1 && row[0].trim().length > 1); // remove blank lines
            // Save common system information.
            this.sysInfo = new GetStateDataSysInfo(this.parsed);
            this.resolveObjects();
        }
    }

    public getCategory(index: number): string {
        for (const category in this.categories) {
            if (this.categories[category].indexOf(index) >= 0) {
                return category;
            }
        }

        return "none";
    }

    public getDataObjects(indices: number[], activeOnly = false): GetStateDataObject[] {
        return activeOnly ?
            this.objects.filter((obj, idx) => indices.indexOf(idx) >= 0 && this.active.indexOf(idx) >= 0) :
            this.objects.filter((obj, idx) => indices.indexOf(idx) >= 0);
    }

    public getDataObject(id: number): GetStateDataObject {
        return this.objects[id] ? this.objects[id] : new GetStateDataObject(id, "", "", "", "", "");
    }

    public getDataObjectsByCategory(category: string, activeOnly = false): GetStateDataObject[] {
        return this.getDataObjects(this.categories[category as GetStateCategory], activeOnly);
    }

    public getChlorineDosageControlId(): number {
        return Math.min(...this.categories.relays) + Number(this.sysInfo.chlorineDosageRelais);
    }

    public getPhMinusDosageControlId(): number {
        return Math.min(...this.categories.relays) + Number(this.sysInfo.phMinusDosageRelais);
    }

    public getPhPlusDosageControlId(): number {
        return Math.min(...this.categories.relays) + Number(this.sysInfo.phPlusDosageRelais);
    }

    public getChlorineDosageControl(): RelayDataObject {
        return new RelayDataObject(this.getDataObject(this.getChlorineDosageControlId()));
    }

    public getPhMinusDosageControl(): RelayDataObject {
        return new RelayDataObject(this.getDataObject(this.getPhMinusDosageControlId()));
    }

    public getPhPlusDosageControl(): RelayDataObject {
        return new RelayDataObject(this.getDataObject(this.getPhPlusDosageControlId()));
    }

    public isDosageControl(id: number): boolean {
        return [
            this.getChlorineDosageControlId(),
            this.getPhMinusDosageControlId(),
            this.getPhPlusDosageControlId()
        ].indexOf(id) >= 0;
    }

    public parseCsv(csv: string): void {
        // Save raw input string.
        this.raw = csv;
        // Parse csv into 2-dimensional array of strings.
        this.parsed = csv.split(/[\r\n]+/) // split rows
            .map((row) => row.split(/[,]/)) // split columns
            .filter((row) => row.length > 1 || row.length === 1 && row[0].trim().length > 1); // remove blank lines
        // Save common system information.
        this.sysInfo = new GetStateDataSysInfo(this.parsed);
        this.resolveObjects();
    }

    private resolveObjects(): void {
        // Iterate data columns.
        this.active.length = 0;
        this.parsed[1].forEach((name, index) => {
            if (this.objects[index] === undefined) {
                // Add object to the objects array.
                this.objects[index] = new GetStateDataObject(index, name,
                    this.parsed[2][index],
                    this.parsed[3][index],
                    this.parsed[4][index],
                    this.parsed[5][index]
                );
            } else {
                this.objects[index].set(index, name,
                    this.parsed[2][index],
                    this.parsed[3][index],
                    this.parsed[4][index],
                    this.parsed[5][index]
                );
            }

            if (this.objects[index].active) { this.active.push(index); }
        });
        this.categorize();
    }

    private categorize(): void {
        Object.keys(this.categories).forEach((category) => {
            let catId = 1;
            this.categories[category] = this.expandSlice(this.categories[category]);
            this.categories[category].forEach((id: number) => {
                if (this.objects[id] !== undefined) {
                    this.objects[id].categoryId = catId++;
                    this.objects[id].category = category;
                }
            });
        });
    }

    private expandSlice(input: number[][]): number[] {
        const output = new Array<number>();
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
