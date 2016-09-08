module.exports =

class TableConstraint {

    constructor(type, keys, foreignSchema = null, foreignTable = null, foreignColumns = null) {
        this.type = type
        this.keys = keys
        this.foreignSchema = foreignSchema
        this.foreignTable = foreignTable
        this.foreignColumns = foreignColumns
    }

    get keys() { return this._keys || (this._keys = []) }
    set keys(value) { this._keys = value }

    get foreignColumns() { return this._foreignColumns || (this._foreignColumns = []) }
    set foreignColumns(value) { this._foreignColumns = value }
}
