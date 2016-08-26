// HACK: Rustic, bearded, angry and sweating
'use strict'

const fs = require('fs')

const Handlebars = require('handlebars')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const changeCase = require('change-case')
const sqlServerParse = require('./parsers/sql-server-parser')
const DIST_FOLDER_PATH = 'dist-entities/'
const classes = require('./classes')
const commander = require('commander');

const LanguageDefinitions = classes.LanguageDefinitions
const ClassField = classes.ClassField
const Class = classes.Class
const File = classes.File

commander
  .version('0.0.1')
  .option('-r, --repository-interface-namespace [value]', 'Repository interfaces namespace')
  .option('-m, --model-namespace [value]', 'Models namespace')
  .option('-R, --repository-implementation-namespace [value]', 'Repository interfaces namespace')
  .parse(process.argv);


const aggregators = {}
function aggregatorField(aggregator, field) {
  const fields = aggregators[aggregator] || {}
  if (!fields[field.fieldName]) fields[field.fieldName] = field
  aggregators[aggregator] = fields
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
      return new Class(className, null, fields, possibleSupertype, null, associatives.length);
  }
}

// PROCESS -------------------------------------------

function generateEntitiesFiles(classes) {

    for (let languageName in BUILTIN_LANGUAGE_DEFINITIONS) {
        const language = BUILTIN_LANGUAGE_DEFINITIONS[languageName]
        const languageOutputFolder = DIST_FOLDER_PATH + language.folderName + '/entities/';

        fs.readFile('templates/entity/' + language.folderName + '.hbs', 'utf8', (err, template) => {
            if (err) return console.log('Cound not find', language.name, 'entity template');

            rimraf(languageOutputFolder, ['rmdir'], err => {
                if (err) return console.log(err)

                mkdirp(languageOutputFolder, (err) => {
                    if (err) return console.error(err)

                    const languageWriter = Handlebars.compile(template)

                    classes.forEach(classDefinition => {
                        if (!classDefinition.isAssociative) {
                          const languageClass = classDefinition.cloneForLanguage(language)
                          languageClass.namespace = modelsNamespace
                          const file = new File(languageOutputFolder, changeCase.pascalCase(languageClass.className) + language.fileExtension, languageWriter(languageClass))

                          fs.writeFile(file.path + file.name, file.content, err => {
                              if (err) {
                                  return console.log(file.path, err);
                              }
                              console.log('Wrote', language.name, file.path + file.name)
                          })
                        }
                    })
                })
            })
        })
    }
}

function generateRepositoryImplementationFiles(classes) {

    for (let languageName in BUILTIN_LANGUAGE_DEFINITIONS) {
        const language = BUILTIN_LANGUAGE_DEFINITIONS[languageName]
        const languageOutputFolder = DIST_FOLDER_PATH + language.folderName + '/repositories/implementations/';

        fs.readFile('templates/repository/implementation/' + language.folderName + '.hbs', 'utf8', (err, template) => {
            if (err) return console.log('Cound not find', language.name, 'repository implementation template');

            rimraf(languageOutputFolder, ['rmdir'], err => {
                if (err) return console.log(err)

                mkdirp(languageOutputFolder, (err) => {
                    if (err) return console.error(err)

                    const languageWriter = Handlebars.compile(template)

                    classes.forEach(classDefinition => {
                        if (!classDefinition.isAssociative) {
                          const languageClass = classDefinition.cloneForLanguage(language)
                          languageClass.namespace = repositoryImplementationsNamespace
                          const file = new File(languageOutputFolder, changeCase.pascalCase(languageClass.className) + 'Repository' + language.fileExtension, languageWriter(languageClass))

                          fs.writeFile(file.path + file.name, file.content, err => {
                              if (err) {
                                  return console.log(file.path, err);
                              }
                              console.log('Wrote', language.name, file.path + file.name)
                          })
                        }
                    })
                })
            })
        })
    }
}

function generateRepositoryInterfaceFiles(classes) {

      for (let languageName in BUILTIN_LANGUAGE_DEFINITIONS) {
          const language = BUILTIN_LANGUAGE_DEFINITIONS[languageName]
          const languageOutputFolder = DIST_FOLDER_PATH + language.folderName + '/repositories/interfaces/';

          fs.readFile('templates/repository/interface/' + language.folderName + '.hbs', 'utf8', (err, template) => {
              if (err) return console.log('Cound not find', language.name, 'repository interface template');

              rimraf(languageOutputFolder, ['rmdir'], err => {
                  if (err) return console.log(err)

                  mkdirp(languageOutputFolder, (err) => {
                      if (err) return console.error(err)

                      const languageWriter = Handlebars.compile(template)

                      classes.forEach(classDefinition => {
                          if (!classDefinition.isAssociative) {
                            const languageClass = classDefinition.cloneForLanguage(language)
                            languageClass.namespace = repositoryInterfacesNamespace
                            const file = new File(languageOutputFolder, 'I' + changeCase.pascalCase(languageClass.className) + 'Repository' + language.fileExtension, languageWriter(languageClass))

                            fs.writeFile(file.path + file.name, file.content, err => {
                                if (err) {
                                    return console.log(file.path, err);
                                }
                                console.log('Wrote', language.name, file.path + file.name)
                            })
                          }
                      })
                  })
              })
          })
      }
  }


// DICTIONARIES -------------------------------------

// SEE: https://msdn.microsoft.com/en-us/library/ms131092(v=sql.120).aspx
// SEE: http://stackoverflow.com/a/968734/1260526
const SQL_TO_CSHARP_DICTIONARY = {
    "BIGINT": 'long',
    "BINARY": 'Byte[]',
    "BIT": 'bool',
    "BLOB": 'byte[]',
    "BOOL": 'bool',
    "BOOLEAN": 'bool',
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
    "VARBINARY": 'bool',
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
    'csharp': new LanguageDefinitions('C#', 'csharp', '.cs', SQL_TO_CSHARP_DICTIONARY, CSHARP_NULL_EXCEPTIONS_DICTIONARY),
    'java': new LanguageDefinitions('Java', 'java', '.java', SQL_TO_JAVA_DICTIONARY, null),
    'golang': new LanguageDefinitions('Go', 'golang', '.go', SQL_TO_GO_DICTIONARY, null),
    'javascript': new LanguageDefinitions('JavaScript', 'javascript', '.js', null, null)
}


let modelsNamespace = commander.modelNamespace || 'Models'
let repositoryImplementationsNamespace = commander.repositoryImplementationNamespace || 'Repositories.Implementations'
let repositoryInterfacesNamespace = commander.repositoryInterfaceNamespace || 'Repositories.Interfaces'

fs.readFile(process.argv[2], 'utf8', (err, data) => {

    if (err) return console.log(err);

    const parsedData = sqlServerParse(data)
    const classes = [];

    if (parsedData) parsedData.forEach(table => classes.push(Table2Class.map(table)))

    classes.forEach(classDefinition => {
      // AGGREGATOR FIELD DASH
      for(let aggregator in aggregators) {
        //console.log(aggregator , classDefinition.className.toString())
        if (aggregator === classDefinition.className.toString()) {
          const aggregatorFields = aggregators[aggregator]
          for(let fieldName in aggregatorFields) {
              classDefinition.fields = classDefinition.fields.concat(aggregatorFields[fieldName])
          }
        }
      }
    })

    generateEntitiesFiles(classes)
    generateRepositoryInterfaceFiles(classes)
    generateRepositoryImplementationFiles(classes)
})
