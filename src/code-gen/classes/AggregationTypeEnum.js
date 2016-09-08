module.exports = Object.freeze(
  AggregationTypeEnum = {
    AGGREGATED_ONCE_BY: 'IS AGGREGATED BY (1:1)',
    MULTI_AGGREGATED_BY: 'IS AGGREGATED BY (M:1)',
    AGGREGATES_ONE: 'AGGREGATES ONE (1:1)',
    AGGREGATES_MANY: 'AGGREGATES MANY (1:M)'
  }
)
