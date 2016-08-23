const changeCase = require('change-case')

class LanguageDefinitions {
    constructor(name, folderName, fileExtension, sqlDictionary, nullExceptionDictionary) {
        this.name = name
        this.folderName = folderName
        this.fileExtension = fileExtension
        this.sqlDictionary = sqlDictionary
        this.nullExceptionDictionary = nullExceptionDictionary
    }
}
exports.LanguageDefinitions = LanguageDefinitions;

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
    constructor(className, namespace, fields, base, dependencies, isAssociative, access) {
        this.className = className
        this.base = base
        this.namespace = namespace
        this.dependencies = dependencies
        this.fields = fields
        this.isAssociative = isAssociative
        this.access = access
    }

    set className(className) { this._className = className }
    get className() { return new MultiCase(this._className) }

    set namespace(className) { this._namespace = className }
    get namespace() { return new MultiCase(this._namespace) }

    set base(base) { this._base = base || null }
    get base() { return this._base ? new MultiCase(this._base) : null }

    set isAssociative(isAssociative) { this._isAssociative = !! isAssociative }
    get isAssociative() { return this._isAssociative }

    set access(access) { this._access = access }
    get access() { return access ? new MultiCase(this._access) : null }

    set dependencies(dependencies) { this._dependencies = Array.isArray(dependencies) ? dependencies : [] }
    get dependencies () { return this._dependencies.slice(0) /* array clone, not deep */ }

    set fields(fields) { this._fields = Array.isArray(fields) ? fields : [] }
    get fields() { return this._fields.map(field => field.clone()) }

    clone() { return new Class(this._className, this._namespace, this.fields, this._base, this.dependencies,  this._isAssociative,  this._access) }

    cloneForLanguage(language) {
        const clone = this.clone()
        clone.namespace = clone._namespace || language.defaultNamespace
        if (language.sqlDictionary) {
           clone._fields.forEach(field => {
             if (!field.isClassReference) field.type = language.sqlDictionary[field.type.upperCase.trim()] || '<Type undefined in ' + language.name + ' SQL dictionary>'
             if (language.nullExceptionDictionary && language.nullExceptionDictionary.indexOf(field.type.toString()) !== -1) field.isNullable = false
          })
        }
        return clone
    }
}
exports.Class = Class

class ClassField {
    constructor(fieldName, type, isNullable, isCollection, isClassReference, access) {
        this.fieldName = fieldName
        this.type = type
        this.isNullable = isNullable
        this.isCollection = isCollection
        this.isClassReference = isClassReference

        // this.isAggregated = isAggregated
        // this.isAssociative =  isAssociative
        this.access = access
    }

    set fieldName(fieldName) { this._fieldName = fieldName }
    get fieldName() { return new MultiCase(this._fieldName) }

    set type(type) { this._type =  type || 'void' }
    get type() { return new MultiCase(this._type) }

    set isClassReference(isClassReference) { this._isClassReference = !! isClassReference }
    get isClassReference() { return this._isClassReference }

    set isNullable(isNullable) { this._isNullable = !! isNullable }
    get isNullable() { return this._isNullable }

    set isCollection(isCollection) { this._isCollection = !! isCollection }
    get isCollection() { return this._isCollection }

    set access(access) { this._access = access }
    get access() { return new MultiCase(this._access) }

    clone() { return new ClassField(this._fieldName, this._type, this._isNullable, this._isCollection, this._isClassReference, this._access) }
}
exports.ClassField = ClassField

class MultiCase {
  constructor(word) {
    this.word = word
  }

  clone() { return new MultiCase(this.word) }

  set word(word) { this._word = String(word) }
  get word() { return this._word }

  toString() { return this.word }

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
