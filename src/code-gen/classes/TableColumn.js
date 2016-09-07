const ForeignKey = require('./ForeignKey')

module.exports =

class TableColumn {
    constructor(name, type, properties, isNullable, isPrimaryKey, foreignKey = null) {
        this.name = name // string
        this.type = type // string
        this.isNullable = isNullable
        this.isPrimaryKey = isPrimaryKey
        this.foreignKey = foreignKey
    }

    get isNullable() { return this._isNullable }
    set isNullable(value) { this._isNullable = !! value }

    get isPrimaryKey() { return this._isPrimaryKey }
    set isPrimaryKey(value) { this._isPrimaryKey = !! value }

    get foreignKey() { return this._foreignKey }
    set foreignKey(value) {
      if (value != null && !(value instanceof ForeignKey)) new TypeReference('foreignKey must be instance of ForeignKey.')
      this._foreignKey = value
    }

}
