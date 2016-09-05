const AggregationTypeEnum = require('./AggregationTypeEnum')
const changeCase = require('change-case')

module.exports =

class AggregationDefinition {
    constructor(referencingTable, referencedTable, foreignFieldName, aggregationType) {
      this.referencingTable = referencingTable // string
      this.referencedTable = referencedTable // string
      this.foreignFieldName = foreignFieldName // string
      this.aggregationType = aggregationType   // string
    }

    static parseDefinition(value) {
      // "REFERENCING_ENTITY.COLUMN AGGREGATION_TYPE REFERENCED_ENTITY"
      const matches = String(value).match(/^\s*([^\s]+)\s*\.\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)/i)
      //console.log(value, matches, '.')
      if (matches) {
        const referencingTable = changeCase.snakeCase(matches[1])
        const referencedTable = changeCase.snakeCase(matches[4])
        const foreignFieldName = changeCase.snakeCase(matches[2])
        const aggregationType = changeCase.snakeCase(matches[3])
        for (const enumType in AggregationTypeEnum) {
          if (aggregationType === changeCase.snakeCase(enumType)) {
            return new AggregationDefinition(referencingTable, referencedTable, foreignFieldName, AggregationTypeEnum[enumType])
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

    static listPossibleDefinitions(aggregationDefinition) {
      const possibilities = []
      if (aggregationDefinition.isResolved === false) {
        for (const aggregationType in AggregationTypeEnum)
          possibilities.push(`${aggregationDefinition.referencingTable}.${aggregationDefinition.foreignFieldName} ${aggregationType} ${aggregationDefinition.referencedTable}`)
      }
      return possibilities
    }
}
