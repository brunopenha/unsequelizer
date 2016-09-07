const AggregationTypeEnum = require('./AggregationTypeEnum')
const changeCase = require('change-case')

module.exports =

class AggregationDefinition {
    constructor(referencingTable, foreignTable, foreignFieldName, aggregationType = null) {
      this.referencingTable = referencingTable  // string
      this.foreignTable  = foreignTable   // string
      this.foreignFieldName = foreignFieldName  // string
      this.aggregationType  = aggregationType   // string
    }

    static parseDefinition(value) {
      // "REFERENCING_ENTITY.COLUMN AGGREGATION_TYPE REFERENCED_ENTITY"
      const matches = String(value).match(/^\s*([^\s]+)\s*\.\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)/i)

      if (matches) {
        const referencingTable  = changeCase.snakeCase(matches[1])
        const foreignTable   = changeCase.snakeCase(matches[4])
        const foreignFieldName  = changeCase.snakeCase(matches[2])
        const aggregationType   = changeCase.snakeCase(matches[3])

        for (const enumType in AggregationTypeEnum) {
          if (aggregationType === changeCase.snakeCase(enumType)) {
            return new AggregationDefinition(referencingTable, foreignTable, foreignFieldName, AggregationTypeEnum[enumType])
          }
        }
      }
      return null
    }

    get isResolved() {
      return !!(this.referencingTable  &&
      this.foreignTable  &&
      this.foreignFieldName &&
      this.aggregationType)
    }

    static listPossibleDefinitions(aggregationDefinition) {
      const possibilities = []
      if (aggregationDefinition.isResolved === false) {
        for (const aggregationType in AggregationTypeEnum)
          possibilities.push(`${aggregationDefinition.referencingTable}.${aggregationDefinition.foreignFieldName} ${aggregationType} ${aggregationDefinition.foreignTable}`)
      }
      else {
        possibilities.push(`${aggregationDefinition.referencingTable}.${aggregationDefinition.foreignFieldName} ${aggregationDefinition.aggregationType} ${aggregationDefinition.foreignTable}`)
      }
      return possibilities
    }
}
