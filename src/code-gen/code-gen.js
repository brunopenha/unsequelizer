// HACK: Rustic, bearded, angry and sweating
'use strict'

// packages
const fs = require('fs')
const Handlebars = require('handlebars')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const changeCase = require('change-case')
const sqlServerParse = require('./parsers/sql-server-parser')

Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
    //console.log(arguments)
    switch (operator) {
        case '==':
            return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
            return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
                return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '!==':
            return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
            return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
            return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
            return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
            return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
            return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
            return (v1 || v2) ? options.fn(this) : options.inverse(this);
        case 'typeof':
            return ( typeof v2 == v1) ? options.fn(this) : options.inverse(this);
        default:
            return options.inverse(this);
    }
})


// CLASSES
const ClassField = require('./classes/ClassField')
const Class = require('./classes/Class')
const File = require('./classes/File')
const MultiCase = require('./classes/MultiCase')
const AggregationTypeEnum = require('./classes/AggregationTypeEnum')
const AggregationDefinition = require('./classes/AggregationDefinition')
const AggregationRegister = require('./classes/AggregationRegister')
const SqlProcessor = require('./classes/SqlProcessor')

// CONSTANTS
const FILE_PLATFORM_DEFINITIONS = 'platforms-definitions.json'
const DIST_FOLDER_PATH = 'dist-entities/'
const TEMPLATE_FOLDER_PATH = 'templates/'

// GLOBALS
const globalPlatformsDefinitions = JSON.parse(fs.readFileSync(FILE_PLATFORM_DEFINITIONS, 'utf8'))

let globalIsDumpMode = false
let globalSqlFilename
let globalDefsFilename


// CLI COMMANDS
const cli = require('commander');
cli
  .version('0.0.1')

  // DUMP DEFS
cli.command('dumpdefs <sql_filename> <desired_dump_filename>')
  .description('Dump aggregation definitions file. Inform the desired dump filename.')
  .action(function(sqlFilename, defsFilename) {
    globalIsDumpMode = true
    globalSqlFilename = sqlFilename
    globalDefsFilename = defsFilename
    main()
  })

  // GENERATE
cli.command('gen <sql_filename> <aggregation_definitions_filename>')
  .description('Generate code using information of sql-script and aggregation definitions files.')
  .action(function(sqlFilename, defsFilename) {
    globalIsDumpMode = false
    globalSqlFilename = sqlFilename
    globalDefsFilename = defsFilename
    loadAggregationDefinitions()
    main()
  })

cli.parse(process.argv);

function loadAggregationDefinitions() {
  // LOAD AGGREGATION DEFINITIONS
  try {

    const definitions = new Map()
    let duplicated = false

    fs.readFileSync(globalDefsFilename, 'utf8').split(/\r?\n/gm).forEach(line => {

      const definition = AggregationDefinition.parseDefinition(line)
      if (definition) {
        const key = `${definition.referencingTable}.${definition.foreignFieldName} ${definition.foreignTable}`
        if (definitions.has(key)) {
          console.log(`Duplicated aggregation definition for: ${key}`)
          duplicated = true
        }
        else {
          definitions.set(key, definition)
        }
      }
    })
    if (duplicated) {
      console.log(`\nCould not generate files due to duplicated aggregation definitions.\n`)
      process.exit(1)
    }

    definitions.forEach(value => AggregationRegister.registerAggregationDefinition(value))
  }
  catch(ex) {
    console.log(`Could not load aggregation definitions file ${defsFilename}.`)
    process.exit(1)
  }
}


function main() {

  rimraf(DIST_FOLDER_PATH, ['rmdir'], err => {
    if (err) return console.log(`Could not delete distribution folder "${DIST_FOLDER_PATH}".`)

    fs.readFile(globalSqlFilename, 'utf8', (err, data) => {
      if (err) return console.log(`Could not load sql definitions from ${globalSqlFilename} file.`);

      console.log(`\nGENERATOR STARTED ON ${globalIsDumpMode ? 'DUMP' : 'GENERATION'} MODE (MODES: DUMP/GENERATION)\n`)

      const parsedData = sqlServerParse(data)

      const classes = SqlProcessor.produceClasses(parsedData, AggregationRegister, globalIsDumpMode)

      if (globalIsDumpMode) {

        let data = 'PLEASE REMOVE THE "#" OF YOUR DESIRED AGGREGATION FORM\n\n'

        AggregationRegister.listUnresolvedAggregation().forEach(unresolved => {
          data += `# ${AggregationDefinition.listPossibleDefinitions(unresolved).join('\n# ')}\n\n`
        })

        console.log(`\nPLEASE EDIT ${globalDefsFilename} AND RE-EXECUTE IN GENERATE MODE (gen).\n`)

        fs.writeFile(globalDefsFilename, data, err => {
          if (err) return console.log(`Could not write ${globalDefsFilename}. Internal error.`, err);
          process.exit(1)
        })

        return;
      }

      // QUIT ON MISSING DEFINITION
      //console.log(AggregationRegister.listUnresolvedAggregation().length)
      if (AggregationRegister.listUnresolvedAggregation().length) {
        console.log(`\nCould not generate files due to missing aggregation definitions.\n`)
        process.exit(1)
      }

      globalPlatformsDefinitions.forEach(language => {
        if (language.isActive) for (var pack in language.packages) generatePlatformFile(pack, classes, language)
      })
    })
  })
}

function generatePlatformFile(pack, classes, language) {

  // PATH == PACKAGE NAME
  const languageOutputFolder = DIST_FOLDER_PATH + language.folderName + '/' + changeCase.pathCase(pack) + '/';
  const templatePath = TEMPLATE_FOLDER_PATH + changeCase.pathCase(pack) + '/'

  fs.readFile(templatePath + language.folderName + '.hbs', 'utf8', (err, template) => {

    if (err) return console.log('COULD NOT FIND', templatePath + language.folderName + '.hbs');
    else console.log('FOUND', templatePath + language.folderName + '.hbs');

    mkdirp(languageOutputFolder, (err) => {
      if (err) return console.error(`COULD NOT CREATE OUTPUT FOLDER ${languageOutputFolder}.`)

      const languageWriter = Handlebars.compile(template)

      console.log(`Writing ${language.name} ${pack}...`)

      classes.forEach(classDefinition => {

        if (classDefinition.isAssociative) return;

        const languageClass = mapClass2Platform(language, classDefinition)

        languageClass.namespace = pack

        const file = new File(languageOutputFolder, Handlebars.compile(language.packages[pack])(new MultiCase(languageClass.className)), languageWriter(languageClass))

        fs.writeFile(file.path + file.name, file.content, err => {
          if (err) return console.log(`COULD NOT WRITE FILE ${file.name}`);
        })
      })
    })
  })
}

function mapClass2Platform(language, classDef) { // TODO create Class mapper for cleaner class definition
    const clone = classDef.clone()
    clone.namespace = clone._namespace || language.defaultNamespace
    if (language.sqlDictionary) {
       clone.fields.forEach(field => {
         if (!field.type.isDomainClassType) field.type = new Class(language.sqlDictionary[field.type.className.upperCase.trim()] || 'UNDEFINED_SQL_TYPE_MAPPING')
         if (language.nullExceptionDictionary && language.nullExceptionDictionary.indexOf(field.type.className.toString()) !== -1) field.isNullable = false
      })
    }
    return clone
}
