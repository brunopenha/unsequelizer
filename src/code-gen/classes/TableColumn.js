const ForeignKey = require('./ForeignKey')

module.exports =

class TableColumn {
    constructor(name, type, properties, isNullable, isPrimaryKey, foreignRef = null) {
        this.name = name  // string
        this.type = type  // string
        this.isNullable = isNullable      // boolean
        this.isPrimaryKey = isPrimaryKey  // boolean
        this.foreignRef = foreignRef      // ForeignKey
    }

    get isNullable() { return this._isNullable }
    set isNullable(value) { this._isNullable = !! value }

    get isPrimaryKey() { return this._isPrimaryKey }
    set isPrimaryKey(value) { this._isPrimaryKey = !! value }

    get foreignRef() { return this._foreignRef }
    set foreignRef(value) {
      if (value != null && !(value instanceof ForeignKey)) new TypeReference('foreignRef must be instance of ForeignKey.')
      this._foreignRef = value
    }
}
