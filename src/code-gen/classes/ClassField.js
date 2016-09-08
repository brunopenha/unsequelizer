const MultiCase = require('./MultiCase')

module.exports =

class ClassField {

    constructor(fieldName, type, isNullable = false, isCollection = false, access = null, isClassIdentifier = false) {
        this.fieldName = fieldName
        this.type = type
        this.isNullable = isNullable
        this.isCollection = isCollection
        this.access = access
        this.isClassIdentifier = isClassIdentifier
    }

    set fieldName(value) { this._fieldName = value }
    get fieldName() { return new MultiCase(this._fieldName) }

    set type(value) { this._type = value }
    get type() { return this._type }

    set isNullable(value) { this._isNullable = !! value }
    get isNullable() { return this._isNullable }

    set isCollection(value) { this._isCollection = !! value }
    get isCollection() { return this._isCollection }

    set access(value) { this._access = value }
    get access() { return access ? new MultiCase(this._access) : null }

    set isClassIdentifier(value) { this._isClassIdentifier = !! value }
    get isClassIdentifier() { return this._isClassIdentifier }

    clone() { return new ClassField(this._fieldName, this._type, this._isNullable, this._isCollection, this._access, this._isClassIdentifier) }
}
