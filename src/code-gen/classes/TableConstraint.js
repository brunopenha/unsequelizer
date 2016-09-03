module.exports =

class TableConstraint {
    constructor(type, keys, referencedSchema, referencedTable) {
        this.type = type
        this.keys = keys || []
        this.referencedSchema = referencedSchema || null
        this.referencedTable = referencedTable || null
    }
}
