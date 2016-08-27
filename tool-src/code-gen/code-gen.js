// HACK: Rustic, bearded, angry and sweating
'use strict'
const fs = require('fs')
const Handlebars = require('handlebars')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const changeCase = require('change-case')
const sqlServerParse = require('./parsers/sql-server-parser')
const classes = require('./classes')
// const commander = require('commander')

const ClassField = classes.ClassField
const Class = classes.Class
const File = classes.File
const MultiCase = classes.MultiCase

// commander
//   .version('0.0.1')
//   .option('-r, --repository-interface-namespace [value]', 'Repository interfaces namespace')
//   .option('-m, --model-namespace [value]', 'Models namespace')
//   .option('-R, --repository-implementation-namespace [value]', 'Repository interfaces namespace')
//   .parse(process.argv)

const DIST_FOLDER_PATH = 'dist-entities/'
const TEMPLATE_FOLDER_PATH = 'templates/'
const PLATFORMS = JSON.parse(fs.readFileSync('platforms-definitions.json', 'utf8'))

const aggregators = {}
function aggregatorField(aggregator, field) {
  const fields = aggregators[aggregator] || {}
  if (!fields[field.fieldName]) fields[field.fieldName] = field
  aggregators[aggregator] = fields
}


fs.readFile(process.argv[2], 'utf8', (err, data) =>
{
    if (err) return console.log(err);

    const parsedData = sqlServerParse(data)
    const classes = [];

    if (parsedData) parsedData.forEach(table => classes.push(mapTable2Class(table)))

    classes.forEach(classDefinition =>
    {
        // AGGREGATOR FIELD DASH
        for (let aggregator in aggregators)
        {
            //console.log(aggregator , classDefinition.className.toString())
            if (aggregator === classDefinition.className.toString())
            {
                const aggregatorFields = aggregators[aggregator]
                for (let fieldName in aggregatorFields)
                {
                    classDefinition.fields = classDefinition.fields.concat(aggregatorFields[fieldName])
                }
            }
        }
    })

    PLATFORMS.forEach(language => {
      if (language.isActive) for (var pack in language.packages) generate(pack, classes, language)
    })
})

function generate(pack, classes, language) {

    // PATH == PACKAGE NAME
    const languageOutputFolder = DIST_FOLDER_PATH + language.folderName + '/' + changeCase.pathCase(pack) +'/';
    const templatePath = TEMPLATE_FOLDER_PATH + changeCase.pathCase(pack) +'/'

    fs.readFile(templatePath + language.folderName + '.hbs', 'utf8', (err, template) => {

        if (err) return console.log('Cound not find', templatePath + language.folderName + '.hbs');

        rimraf(languageOutputFolder, ['rmdir'], err => {
            if (err) return console.log(err)

            mkdirp(languageOutputFolder, (err) => {
                if (err) return console.error(err)

                const languageWriter = Handlebars.compile(template)

                classes.forEach(classDefinition => {
                    if (!classDefinition.isAssociative) {
                      const languageClass = classDefinition.cloneForLanguage(language)

                      languageClass.namespace = pack

                      const file = new File(languageOutputFolder, Handlebars.compile(language.packages[pack])(new MultiCase(languageClass.className)), languageWriter(languageClass))

                      fs.writeFile(file.path + file.name, file.content, err => {
                          if (err) return console.log(file.path, err);
                          console.log('Wrote', language.name, file.path + file.name)
                      })
                    }
                })
            })
        })
    })
}


function mapTable2Class(table) {

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
                // HACK !!!
                if (possibleSupertype === null) possibleSupertype = constraint.referencedTable
                else associatives.push(constraint.referencedTable)
                // HACK-END
              }
              else {

                fields.push(new ClassField(
                      stripIdentifier(foreignKey), // fieldName
                      constraint.referencedTable, // type
                      columns.find(column => column.name === foreignKey).isNullable, // isNullable?
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
    // HACK !!!
    associatives.push(possibleSupertype)
    possibleSupertype = null
    // HACK-END

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
        column.isNullable, // isNullable?
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

function stripIdentifier(fieldName) {
  return fieldName.replace(/(?:\b|_|\s)id(?:\b|_|\s)/i, '');
}
