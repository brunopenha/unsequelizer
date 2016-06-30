'use strict'

const fs = require('fs')

const Handlebars = require('handlebars')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const changeCase = require('change-case')



const DIST_FOLDER_PATH = 'dist-entities/'


// PROCESS -------------------------------------------

function parseTables(data) {

    const SQL_DATA_TYPES = 'CHAR|CHARACTER|VARCHAR|NVARCHAR|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|BINARY|VARBINARY|BIT|TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|DEC|NUMERIC|FIXED|FLOAT|DOUBLE|DOUBLE[^w|;]+PRECISION|REAL|BOOL|BOOLEAN|DATE|DATETIME|DATETIME2|UNIQUEIDENTIFIER|UUID|GUID|TIMESTAMP|TIME|YEAR|TINYBLOB|BLOB|MEDIUMBLOB|FILESTREAM|NUMERIC|LONGTEXT|MONEY|CURRENCY|NCHAR|NTEXT|SQL_VARIANT|TABLE|CURSOR';

    const REGEX_CREATE_TABLE = /\bCREATE\W+TABLE[^;]+/gim
    const REGEX_TABLE_SCHEMA_NAME = /\bCREATE\W+TABLE.+?(?:(\w+)\W*\.\W*)?(\w+)\W*\(/gim
    const REGEX_TABLE_CONTENT = /\bCREATE\W+TABLE[^(]+\(([\s\S]+)\)/gim

  //  const REGEX_NOT_COLUMN = /^\W*(?:PRIMARY\W+KEY|CONSTRAINT)[^,]+,?/gim

    const REGEX_TABLE_COLUMN = new RegExp('(?:\\W*(\\w+)\\W+(' + SQL_DATA_TYPES + ')(?:\\W*\\([^)]+\\))?([\\s\\S]+))', 'gim') // [name, type, properties]

    const REGEX_CONSTRAINT_REFERENCE =
        /\bCONSTRAINT[^,)]+(PRIMARY|FOREIGN)\W+KEY\W*\(([^)]+)\)(?:\W+REFERENCES\W+(?:(\w+)\W*\.\W*)?(\w+))?/gim; // [type, keys, schema, referenced table]


    const tables = []

    multiMatch(data.replace(/(?:\r?\n|\s)+/gim, ' '), REGEX_CREATE_TABLE, table => {

        REGEX_TABLE_SCHEMA_NAME.lastIndex = 0
        const titleMatch = REGEX_TABLE_SCHEMA_NAME.exec(table)
        const tableSchema = changeCase.snakeCase(titleMatch[1])
        const tableName = changeCase.snakeCase(titleMatch[2])

        multiMatch(table, REGEX_TABLE_CONTENT, (match, content) => {

            const tableDTO = new Table(tableSchema, tableName);

            content.split(/,(?![^(]*\))/m).forEach(commandLine => {

                // console.log(commandLine)
                REGEX_CONSTRAINT_REFERENCE.lastIndex = 0
                if (REGEX_CONSTRAINT_REFERENCE.test(commandLine)) {

                        multiMatch(commandLine, REGEX_CONSTRAINT_REFERENCE, (declaration, type, keys, referencedSchema, referencedTable) => {
// console.log(declaration)
                            tableDTO.constraints.push(new TableConstraint(changeCase.upperCase(type), keys.split(',').map(key => changeCase.snakeCase(key)), changeCase.snakeCase(referencedSchema), changeCase.snakeCase(referencedTable)))
                        })

                } else {

                    multiMatch(commandLine, REGEX_TABLE_COLUMN, (column, name, type, properties) => {
                      //console.log(type)
                          tableDTO.columns.push(new TableColumn(changeCase.snakeCase(name), changeCase.upperCase(type), changeCase.upperCase(properties)))
                    })
                }
                if (tableName === 'bank_account_kind') console.log(commandLine)
            })

            tables.push(tableDTO);
        })
    })

    return tables;
}

// TODO ENHANCE AGGREGATOR ENGINE
const aggregators = {}

function aggregatorField(aggregator, field) {
  const fields = aggregators[aggregator] || {}
  if (!fields[field.fieldName]) fields[field.fieldName] = field
  aggregators[aggregator] = fields
}




function generateEntitiesFiles(parsed) {
    const classes = [];

    if (parsed) parsed.forEach(table => {
      if (table.name === 'bank_account_kind') console.log(table)
        classes.push(Table2Class.map(table));
    })

    console.log(aggregators)

    classes.forEach(classDefinition => {

      // AGGREGATOR FIELD DASH
      for(let aggregator in aggregators) {
          console.log(aggregator , classDefinition.className.toString())
        if (aggregator === classDefinition.className.toString()) {

          const aggregatorFields = aggregators[aggregator]
          for(let fieldName in aggregatorFields) {
              classDefinition.fields = classDefinition.fields.concat(aggregatorFields[fieldName])
          }
        }
      }


    })


    for (let languageName in BUILTIN_LANGUAGE_DEFINITIONS) {
        const language = BUILTIN_LANGUAGE_DEFINITIONS[languageName]
        const languageOutputFolder = DIST_FOLDER_PATH + language.folderName;

        rimraf(languageOutputFolder, ['rmdir'], err => {

            if (err) return console.log(err)

            mkdirp(languageOutputFolder, (err) => {
                if (err) return console.error(err)

                fs.readFile('templates/entity/' + language.folderName + '.hbs', 'utf8', (err, template) => {
                    if (err) {
                        return console.log(err)
                    }

                    const languageWriter = Handlebars.compile(template)

                    classes.forEach(classDefinition => {
                        if (!classDefinition.isAssociative) {
                          const languageClass = classDefinition.cloneForLanguage(language)
                          const file = new File(DIST_FOLDER_PATH + language.folderName + '/', changeCase.pascalCase(languageClass.className) + language.fileExtension, languageWriter(languageClass))

                          fs.writeFile(file.path + file.name, file.content, err => {
                              if (err) {
                                  return console.log(file.path, err);
                              }
                              console.log('Wrote', language.name, file.path + file.name)

                          });
                        }
                    })
                })
            })
        })
    }
}



// CLASSES --------------------------------------------

class LanguageDefinitions {
    constructor(name, folderName, defaultNamespace, fileExtension, sqlDictionary, nullExceptionDictionary) {
        this.name = name
        this.folderName = folderName
        this.defaultNamespace = defaultNamespace
        this.fileExtension = fileExtension
        this.sqlDictionary = sqlDictionary
        this.nullExceptionDictionary = nullExceptionDictionary
    }
}

class File {
    constructor(path, name, content, language) {
        this.path = path
        this.name = name
        this.content = content
        this.language = language
    }
}

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

class TableColumn {
    constructor(name, type, properties) {
        this.name = name
        this.type = type
        this.properties = properties || []
        this.isNullable = !properties.match(/NOT\W+NULL/gim);
    }
}


class TableConstraint {
    constructor(type, keys, referencedSchema, referencedTable) {
        this.type = type
        this.keys = keys || []
        this.referencedSchema = referencedSchema || null
        this.referencedTable = referencedTable || null
    }
}


class Class {
    constructor(className, namespace, fields, base, dependencies, isAssociative, access) {
        this.className = className
        this.namespace = namespace
        this.base = base
        this.dependencies = dependencies
        this.fields = fields
        this.isAssociative = isAssociative
        this.access = access
    }

    set className(className) {
      this._className = className
    }

    get className() {
      return new MultiCase(this._className)
    }

    set namespace(namespace) {
      this._namespace = namespace
    }

    get namespace() {
      return new MultiCase(this._namespace)
    }

    set base(base) {
      this._base = base || null
    }

    get base() {
      return this._base ? new MultiCase(this._base) : null
    }

    set isAssociative(isAssociative) {
      this._isAssociative = !! isAssociative
    }

    get isAssociative() {
      return this._isAssociative
    }

    set access(access) {
      this._access = access
    }

    get access() {
      return access ? new MultiCase(this._access) : null
    }

    set dependencies(dependencies) {
      this._dependencies = Array.isArray(dependencies) ? dependencies : []
    }

    get dependencies () {
      return this._dependencies.slice(0) // array clone, not deep
    }

    set fields(fields) {
      this._fields = Array.isArray(fields) ? fields : []
    }

    get fields() {
      // return this._fields.map(field => field.clone())
      return this._fields.map(field => field.clone())
    }


    clone() {
      return new Class(this._className, this._namespace, this.fields, this._base, this.dependencies,  this._isAssociative,  this._access);
    }

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

    set fieldName(fieldName) {
      this._fieldName = fieldName
    }
    get fieldName() {
      return new MultiCase(this._fieldName)
    }

    set type(type) {
      this._type =  type || 'void'
    }

    get type() {
      return new MultiCase(this._type)
    }

    set isClassReference(isClassReference) {
      this._isClassReference = !! isClassReference
    }

    get isClassReference() {
      return this._isClassReference
    }

    // set isAssociative() {
    //   this._isAssociative = !! isAssociative
    // }
    //
    // get isAssociative() {
    //   return this._isAssociative
    // }

    set isNullable(isNullable) {
      this._isNullable = !! isNullable
    }

    get isNullable() {
      return this._isNullable
    }

    set isCollection(isCollection) {
      this._isCollection = !! isCollection
    }

    get isCollection() {
      return this._isCollection
    }

    set access(access) {
      this._access = access
    }

    get access() {
      return new MultiCase(this._access)
    }

    clone() {
      return new ClassField(this._fieldName, this._type, this._isNullable, this._isCollection, this._isClassReference, this._access)
    }
}

class MultiCase {
  constructor(word) {
    this.word = word
  }

  clone() {
    return new MultiCase(this.word)
  }

  set word(word) {
    this._word = String(word)
  }

  get word() {
    return this._word
  }

  toString() {
    return this.word
  }

  get paramCase() {
    return changeCase.paramCase(this.word)
  }

  get pascalCase() {
    return changeCase.pascalCase(this.word)
  }

  get lowerCase() {
    return changeCase.lowerCase(this.word)
  }

  get upperCase() {
    return changeCase.upperCase(this.word)
  }

  get headerCase() {
      return changeCase.headerCase(this.word)
  }

  get pathCase() {
    return changeCase.pathCase(this.word)
  }

  get sentenceCase() {
    return changeCase.sentenceCase(this.word)
  }

  get snakeCase() {
    return changeCase.snakeCase(this.word)
  }

  get camelCase() {
    return changeCase.camelCase(this.word)
  }

  get dotCase() {
    return changeCase.dotCase(this.word)
  }

  get constantCase() {
    return changeCase.constantCase(this.word)
  }

  get namespaceLowerCase() {
    return this.dotCase
  }

  get namespacePascalCase() {
    let result = ''
    this.dotCase.split('.').forEach(part=> {
      result += (result ? '.' : '') + new MultiCase(part).pascalCase
    })
    return result
  }
}



class Table2Class {

    static map(table) {

      const className = table.name

      const columns = table.columns
      const constraints = table.constraints

      let possibleSupertype = null
      const associatives = []
      const constraintKeys = []

      let fields = []

      constraints.forEach(constraint => {

          if (constraint.type.toUpperCase() === 'FOREIGN') {

              constraint.keys.forEach(foreignKey => {

                  // FOREIGN COMPOSES PRIMARY (Many to many) ?
                  const composesPrimary = constraints.some(comparedConstraint => {
                      if (comparedConstraint.type.toUpperCase() === 'PRIMARY') {
                          return comparedConstraint.keys.some(primaryKey => {
                              return foreignKey === primaryKey
                          })
                      }
                  })

                  if (composesPrimary) {
                    if (possibleSupertype === null) possibleSupertype = constraint.referencedTable
                    else associatives.push(constraint.referencedTable)
                  }
                  else {
                    fields.push(new ClassField(
                          constraint.referencedTable, // fieldName
                          constraint.referencedTable, // type
                          true, // isNullable?
                          false, // isCollection
                          true  // isClassReference
                    ))
                  }

                  constraintKeys.push(foreignKey)
              })
          }
      })

      // IF IS ASSOCIATIVE TABLE
      if (associatives.length) {
        associatives.push(possibleSupertype)
        possibleSupertype = null
        associatives.forEach(associative => {
          associatives.forEach(otherAssociative => {
            if (associative === otherAssociative) return;
            //console.log(className, associative)
            aggregatorField(associative,
                new ClassField(
                    className + (associatives.length < 3 ? '' : '_' + otherAssociative), // fieldName
                    otherAssociative, // type
                    true, // isNullable?
                    true, // isCollection
                    true // isClassReference?
                )
            )
          })
        })
      }



      fields = columns.filter(column => { // FILTERS OUT COLUMNS IN PRIMARY/FOREIGN KEY
        return constraintKeys.indexOf(column.name) === -1
      }).map(column => {
        return new ClassField(
            column.name, // fieldName
            column.type, // type
            !(/\bNOT\W+NULL\b/gim).test(column.properties), // isNullable?
            false, // isCollection
            false // isClassReference
        )
      }).concat(fields)


      // if (columns) columns.forEach(column => {
      //
      //     let isForeign = constraints.some(constraint => {
      //         //console.log(constraint.type, constraint.type.toLowerCase() === 'foreign')
      //         if (constraint.type.toLowerCase() === 'foreign') {
      //             return constraint.keys.some(key => {
      //                 if (constraint.referencedTable !== this.base) {
      //                     aggregatorField(this.className.toString(),
      //                         new ClassField(
      //                             constraint.referencedTable, // fieldName
      //                             constraint.referencedTable, // type
      //                             true, // isNullable?
      //                             true // isAggregated
      //                         )
      //                     )
      //                 }
      //                 return column.name.toLowerCase() === key.toLowerCase();
      //
      //             })
      //         }
      //     })
      //
      //     if (isForeign) return;
      //
      //     fields.push(new ClassField(
      //         column.name, // fieldName
      //         column.type, // type
      //         false, // (/\bNOT\W+NULL\b/gim).test(column.properties), // isNullable?
      //         false // isAggregated
      //     ))
      // })
      return new Class(className, cliNamespace, fields, possibleSupertype, null, associatives.length);
  }
}




// UTILS ---------------------------------------------

function multiMatch(str, regex, fn) {
    let indexBefore = regex.lastIndex
    regex.lastIndex = 0
    fn.apply(null, regex.exec(str))
    if (regex.global) {
        let match
        while (match = regex.exec(str)) fn.apply(null, match)
    }
    regex.lastIndex = indexBefore
}


// DICTIONARIES -------------------------------------

// SEE: https://msdn.microsoft.com/en-us/library/ms131092(v=sql.120).aspx
// SEE: http://stackoverflow.com/a/968734/1260526
const SQL_TO_CSHARP_DICTIONARY = {
    "BIGINT": 'long',
    "BINARY": 'Byte[]',
    "BIT": 'boolean',
    "BLOB": 'byte[]',
    "BOOL": 'boolean',
    "BOOLEAN": 'boolean',
    "CHAR": '<CHAR>',
    "CURRENCY": 'decimal',
    "CURSOR": '<CURSOR>',
    "DATE": 'DateTime',
    "DATETIME": 'DateTime',
    "DATETIME2": 'DateTime',
    "DEC": 'decimal',
    "DECIMAL": 'decimal',
    "DOUBLE PRECISION": 'double',
    "DOUBLE": 'double',
    "FILESTREAM": 'FileStream',
    "FLOAT": 'float',
    "GUID": 'Guid',
    "INT": 'int',
    "INTEGER": 'int',
    "LONGTEXT": 'string',
    "MEDIUMBLOB": 'byte[]',
    "MEDIUMINT": 'int',
    "MEDIUMTEXT": 'string',
    "MONEY": 'decimal',
    "NCHAR": 'char',
    "NTEXT": 'string',
    "NVARCHAR": 'string',
    "NUMERIC": 'long',
    "REAL": 'Single',
    "SMALLINT": 'short',
    "SQL_VARIANT": 'object',
    "TABLE": '<TABLE>',
    "TEXT": 'string',
    "TIME": 'DateTime',
    "TIMESTAMP": 'DateTime',
    "TINYBLOB": 'byte[]',
    "TINYINT": 'byte',
    "TINYTEXT": 'string',
    "UNIQUEIDENTIFIER": 'Guid',
    "UUID": 'Guid',
    "VARBINARY": 'boolean',
    "VARCHAR": 'string',
    "YEAR": 'DateTime'
}

const CSHARP_NULL_EXCEPTIONS_DICTIONARY = [
  'string',
  'object'
]

const SQL_TO_JAVA_DICTIONARY = { // SEE: http://stackoverflow.com/a/968734/1260526
    "BIGINT": 'BigInteger',
    "BINARY": 'Byte',
    "BIT": 'Boolean',
    "BLOB": 'byte[]',
    "BOOL": 'Boolean',
    "BOOLEAN": 'Boolean',
    "CHAR": 'Char',
    "CURRENCY": 'BigDecimal',
    "CURSOR": '<CURSOR>',
    "DATE": 'Calendar',
    "DATETIME": 'Calendar',
    "DATETIME2": 'Calendar',
    "DEC": 'BigDecimal',
    "DECIMAL": 'BigDecimal',
    "DOUBLE PRECISION": 'Double',
    "DOUBLE": 'Double',
    "FILESTREAM": 'ByteStream',
    "FLOAT": 'Float',
    "GUID": 'String',
    "INT": 'Integer',
    "INTEGER": 'Integer',
    "LONGTEXT": 'String',
    "MEDIUMBLOB": 'byte[]',
    "MEDIUMINT": 'Integer',
    "MEDIUMTEXT": 'String',
    "MONEY": 'BigDecimal',
    "NCHAR": 'Char',
    "NVARCHAR": 'String',
    "NTEXT": 'String',
    "NUMERIC": 'Long',
    "REAL": 'Double',
    "SMALLINT": 'Short',
    "SQL_VARIANT": '<SQL_VARIANT>',
    "TABLE": '<TABLE>',
    "TEXT": 'String',
    "TIME": 'Calendar',
    "TIMESTAMP": 'Calendar',
    "TINYBLOB": 'byte[]',
    "TINYINT": 'Byte',
    "TINYTEXT": 'String',
    "UNIQUEIDENTIFIER": 'Guid',
    "UUID": 'String',
    "VARBINARY": 'boolean',
    "VARCHAR": 'String',
    "YEAR": 'Calendar'
}

const SQL_TO_GO_DICTIONARY = { // SEE: http://stackoverflow.com/a/968734/1260526
    "BIGINT": 'int64',
    "BINARY": 'uint8',
    "BIT": 'bool',
    "BLOB": '[]byte',
    "BOOL": 'bool',
    "BOOLEAN": 'bool',
    "CHAR": '[]byte',
    "CURRENCY": 'float64',
    "CURSOR": '<CURSOR>',
    "DATE": 'Time',
    "DATETIME": 'Time',
    "DATETIME2": 'Time',
    "DEC": 'float64',
    "DECIMAL": 'float64',
    "DOUBLE PRECISION": 'float64',
    "DOUBLE": 'float64',
    "FILESTREAM": '[]byte',
    "FLOAT": 'float32',
    "GUID": 'string',
    "INT": 'int32',
    "INTEGER": 'int32',
    "LONGTEXT": 'string',
    "MEDIUMBLOB": '[]byte',
    "MEDIUMINT": 'int32',
    "MEDIUMTEXT": 'string',
    "MONEY": 'float64',
    "NCHAR": '[]byte',
    "NVARCHAR": 'string',
    "NTEXT": 'string',
    "NUMERIC": 'int64',
    "REAL": 'float64',
    "SMALLINT": 'int16',
    "SQL_VARIANT": '<SQL_VARIANT>',
    "TABLE": '<TABLE>',
    "TEXT": 'string',
    "TIME": 'Time',
    "TIMESTAMP": 'Time',
    "TINYBLOB": '[]byte',
    "TINYINT": 'uint8',
    "TINYTEXT": 'string',
    "UNIQUEIDENTIFIER": 'string',
    "UUID": 'string',
    "VARBINARY": 'bool',
    "VARCHAR": 'string',
    "YEAR": 'Time'
}


// EXECUTE ------------------------------------------
const BUILTIN_LANGUAGE_DEFINITIONS = {
    'csharp': new LanguageDefinitions('C#', 'csharp', 'Core.Models', '.cs', SQL_TO_CSHARP_DICTIONARY, CSHARP_NULL_EXCEPTIONS_DICTIONARY),
    'java': new LanguageDefinitions('Java', 'java', 'Core.Models', '.java', SQL_TO_JAVA_DICTIONARY, null),
    'golang': new LanguageDefinitions('Go', 'golang', 'Core.Models', '.go', SQL_TO_GO_DICTIONARY, null),
    'javascript': new LanguageDefinitions('JavaScript', 'javascript', 'Core.Models', '.js', null, null)
}


let cliNamespace = process.argv[3]
fs.readFile(process.argv[2], 'utf8', (err, data) => {

    if (err) {
        return console.log(err);
    }

    generateEntitiesFiles(parseTables(data));

})
