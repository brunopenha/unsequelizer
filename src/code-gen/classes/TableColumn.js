const ForeignKey = require('./ForeignKey')

module.exports =

class TableColumn {
    constructor(name, type, isNullable, isPrimaryKey, foreignRef = null, hasDatabaseGeneratedId = false) {
        this.name = name  // string
        this.type = type  // string
        this.isNullable = isNullable      // boolean
        this.isPrimaryKey = isPrimaryKey  // boolean
        this.foreignRef = foreignRef      // ForeignKey
        this.hasDatabaseGeneratedId = hasDatabaseGeneratedId
    }

    set hasDatabaseGeneratedId(value) { this._hasDatabaseGeneratedId = !! value }
    get hasDatabaseGeneratedId() { return this._hasDatabaseGeneratedId }

    get isNullable() { return this._isNullable }
    set isNullable(value) { this._isNullable = !! value }

    get isPrimaryKey() { return this._isPrimaryKey }
    set isPrimaryKey(value) { this._isPrimaryKey = !! value }

    get foreignRef() { return this._foreignRef }
    set foreignRef(value) {
      if (value != null && !(value instanceof ForeignKey)) {
        console.log(this)
        new TypeReference('foreignRef must be instance of ForeignKey.')
      }
      this._foreignRef = value
    }
}
