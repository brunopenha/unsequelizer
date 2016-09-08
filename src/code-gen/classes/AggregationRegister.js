const Class = require('./Class')
const ClassField = require('./ClassField')
const AggregationDefinition = require('./AggregationDefinition')

module.exports =

class AggregationRegister {

  static registerFieldAggregation(aggregator, classField) {

      if (typeof aggregator !== 'string') throw new TypeError('aggregator is not a instance of Class')
      if (!(classField instanceof ClassField)) throw new TypeError('classField is not a instance of ClassField')

      const register = this._register || (this._register = {})
      const classFields = register[aggregator] || (register[aggregator] = {})

      // TODO test for classfield duplication
      if (!classFields[classField.fieldName]) classFields[classField.fieldName] = classField
  }

  static listFieldAggregations() {
    return this._register || (this._register = {})
  }

  static registerAggregationDefinition(aggregationDefinition) {

    if (!(aggregationDefinition instanceof AggregationDefinition)) throw new TypeError('aggregationDefinition is not a instance of AggregationDefinition');

    if (!this._aggregationDefs) this._aggregationDefs = []

    this._aggregationDefs.push(aggregationDefinition)
  }

  static listUnresolvedAggregation() {
    return this._aggregationDefs ? this._aggregationDefs.filter(definition => definition.isResolved == false) : (this._aggregationDefs = [])
  }

  static listResolvedAggregation() {
    return this._aggregationDefs ? this._aggregationDefs.filter(definition => definition.isResolved) : (this._aggregationDefs = [])
  }
}
