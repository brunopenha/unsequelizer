module.exports =

class TableConstraint {

    constructor(type, keys, foreignSchema = null, foreignTable = null, foreignColumn = null) {
        this.type = type
        this.keys = keys
        this.foreignSchema = foreignSchema
        this.foreignTable = foreignTable
        this.foreignColumn = foreignColumn
    }

    get keys() { return this._keys || (this._keys = []) }
    set keys(value) { this._keys = value }
}
