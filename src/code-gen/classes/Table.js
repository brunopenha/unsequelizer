module.exports =

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
