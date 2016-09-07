const MultiCase = require('./MultiCase')

module.exports =

class Class {
    constructor(className, isDomainClassType = false, namespace, fields, supertype = null, dependencies = null, isAssociative = false, access = null) {
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
    get className() { return this._className ? new MultiCase(this._className) : null }

    set namespace(value) { this._namespace = value }
    get namespace() { return this._namespace ? new MultiCase(this._namespace) : null }

    set supertype(value) { this._supertype = value }
    get supertype() { return this._supertype }

    set isAssociative(value) { this._isAssociative = !! value }
    get isAssociative() { return this._isAssociative }

    set isDomainClassType(value) { this._isDomainClassType = !! value }
    get isDomainClassType() { return this._isDomainClassType }

    set access(value) { this._access = value }
    get access() { return this._access ? new MultiCase(this._access) : null }

    set dependencies(value) { this._dependencies = value }
    get dependencies () { return this._dependencies || (this._dependencies = []) }

    set fields(value) { this._fields = value }
    get fields() { return this._fields || (this._fields = [])}

    clone() {
      return new Class(
        this._className,
        this._isDomainClassType,
        this._namespace,
        this.fields,
        this._supertype,
        this.dependencies,
        this._isAssociative,
        this._access
      )
    }
}
