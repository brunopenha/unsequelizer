const changeCase = require('change-case')

const AGGREGATION_TYPE_ENUM = {
  AGGREGATED_BY_ONE: 'IS AGGREGATED BY (1:1)',
  AGGREGATED_BY_MANY: 'IS AGGREGATED BY (M:1)',
  AGGREGATES_ONE: 'AGGREGATES ONE (1:1)',
  AGGREGATES_MANY: 'AGGREGATES MANY (1:M)'
}
exports.AGGREGATION_TYPE_ENUM = AGGREGATION_TYPE_ENUM

class AggregationDefinition {
    constructor(referencingTable, referencedTable, foreignFieldName, aggregationType) {
      this.referencingTable = referencingTable || null // string
      this.referencedTable = referencedTable || null // string
      this.foreignFieldName = foreignFieldName || null // string
      this.aggregationType = aggregationType || null   // string
    }

    static parseDefinition(value) {
      const matches = String(value).match(/\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+\(\s*column\s+([^\s]+).+/i)
      if (matches) {
        const referencingTable = matches[1]
        const referencedTable = matches[3]
        const foreignFieldName = matches[4]
        const aggregationType = matches[2]
        for (const enumType in AGGREGATION_TYPE_ENUM) {
          if (changeCase.snakeCase(aggregationType) === changeCase.snakeCase(enumType)) {
            return new AggregationDefinition(referencingTable, referencedTable, foreignFieldName, aggregationType)
          }
        }
      }
      return null
    }

    get isResolved() {
      return !!(this.referencingTable  &&
      this.referencedTable  &&
      this.foreignFieldName &&
      this.aggregationType)
    }

    static listPossibleAggregationTypes(aggregationDefinition) {
      const possibilities = []
      if (aggregationDefinition.isResolved === false) {
        for (const aggregationType in AGGREGATION_TYPE_ENUM)
          possibilities.push(`${aggregationDefinition.referencingTable} ${aggregationType} ${aggregationDefinition.referencedTable} (column ${aggregationDefinition.foreignFieldName} of ${aggregationDefinition.referencingTable})`)
      }
      return possibilities
    }
}
exports.AggregationDefinition = AggregationDefinition

class File {
    constructor(path, name, content, language) {
        this.path = path
        this.name = name
        this.content = content
        this.language = language
    }
}
exports.File = File

class Table {
    constructor(schema, name, columns, constraints) {
        this.schema = schema || null
        this.name = name
        this.columns = columns || []
        this.constraints = constraints || []
    }

    getFirstForeignReference() {
        return this.foreignReferences && this.foreignReferences.length ? this.foreignReferences[0].entityName : '';
    }
}
exports.Table = Table


class TableColumn {
    constructor(name, type, properties) {
        this.name = name
        this.type = type
        this.properties = properties || []
        this.isNullable = !properties.match(/NOT\W+NULL/gim);
    }
}
exports.TableColumn = TableColumn

class TableConstraint {
    constructor(type, keys, referencedSchema, referencedTable) {
        this.type = type
        this.keys = keys || []
        this.referencedSchema = referencedSchema || null
        this.referencedTable = referencedTable || null
    }
}
exports.TableConstraint = TableConstraint


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
exports.Class = Class

class ClassField {
    constructor(fieldName, type, isNullable, isCollection, access) {
        this.fieldName = fieldName
        this.type = type
        this.isNullable = isNullable
        this.isCollection = isCollection
        this.access = access
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

    clone() { return new ClassField(this._fieldName, this._type, this._isNullable, this._isCollection, this._access) }
}
exports.ClassField = ClassField

class MultiCase {
  constructor(word) {
    this.word = word
  }

  clone() { return new MultiCase(this.word) }

  set word(value) { this._word = String(value) }
  get word() { return this._word }

  toString() { return this._word }
  valueOf() { return this._word }

  get paramCase() { return changeCase.paramCase(this.word) }

  get pascalCase() { return changeCase.pascalCase(this.word) }

  get lowerCase() { return changeCase.lowerCase(this.word) }

  get upperCase() { return changeCase.upperCase(this.word) }

  get headerCase() { return changeCase.headerCase(this.word) }

  get pathCase() { return changeCase.pathCase(this.word) }

  get sentenceCase() { return changeCase.sentenceCase(this.word) }

  get snakeCase() { return changeCase.snakeCase(this.word) }

  get camelCase() { return changeCase.camelCase(this.word) }

  get dotCase() { return changeCase.dotCase(this.word) }

  get constantCase() { return changeCase.constantCase(this.word) }

  get namespaceLowerCase() { return this.dotCase }

  get namespacePascalCase() {
    let result = ''
    this.dotCase.split('.').forEach(part=> {
      result += (result ? '.' : '') + new MultiCase(part).pascalCase
    })
    return result
  }
}
exports.MultiCase = MultiCase
