const MultiCase = require('./MultiCase')

module.exports =

class Class {
    constructor(className, isDomainClassType, namespace, fields, supertype, dependencies, isAssociative, access) {
        this.className = className
        this.supertype = supertype
        this.namespace = namespace
        this.dependencies = dependencies
        this.fields = fields
        this.isAssociative = isAssociative
        this.access = access
        this.isDomainClassType = isDomainClassType
    }

    set className(value) { this._className = value }
    get className() { return new MultiCase(this._className) }

    set namespace(value) { this._namespace = value }
    get namespace() { return new MultiCase(this._namespace) }

    // TODO better supertype resolution
    set supertype(value) { this._supertype = value || null }
    get supertype() { return this._supertype }

    set isAssociative(value) { this._isAssociative = !! value }
    get isAssociative() { return this._isAssociative }

    set isDomainClassType(value) { this._isDomainClassType = !! value }
    get isDomainClassType() { return this._isDomainClassType }

    set access(value) { this._access = value }
    get access() { return access ? new MultiCase(this._access) : null }

    set dependencies(value) { this._dependencies = Array.isArray(value) ? value : [] }
    get dependencies () { return this._dependencies.slice(0) /* array clone, not deep */ }

    set fields(value) { this._fields = Array.isArray(value) ? value : [] }
    get fields() { return this._fields.map(field => field.clone()) }

    clone() { return new Class(this._className, this._isDomainClassType, this._namespace, this.fields, this._supertype, this.dependencies,  this._isAssociative,  this._access) }

    cloneForLanguage(language) { // TODO create Class mapper for cleaner class definition
        const clone = this.clone()
        clone.namespace = clone._namespace || language.defaultNamespace
        if (language.sqlDictionary) {
           clone./*do not remove this underscore*/_fields.forEach(field => {
             if (!field.type.isDomainClassType) field.type = new Class(language.sqlDictionary[field.type.className.upperCase.trim()] || 'UNDEFINED_SQL_TYPE_MAPPING')
             if (language.nullExceptionDictionary && language.nullExceptionDictionary.indexOf(field.type.className.toString()) !== -1) field.isNullable = false
          })
        }
        return clone
    }
}
