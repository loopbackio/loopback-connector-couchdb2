// Copyright IBM Corp. 2020. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

const should = require('should');

if (!process.env.COUCHDB2_TEST_SKIP_INIT) {
  require('./init.js');
}

let db, newInstId, Todo, Item;

describe('couchdb2 findById', function() {
  before(function(done) {
    db = global.getDataSource();

    Todo = db.define('Todo', {
      id: {type: String, id: true},
      name: {type: String},
    }, {forceId: false});

    Item = db.define('Item', {
      id: {type: String, id: true},
      name: {type: String},
    }, {forceId: false});

    db.automigrate(function(err) {
      should.not.exist(err);
      done();
    });
  });

  it('find an existing instance by id (Promise variant)', async function() {
    const todo = await Todo.create({name: 'a todo'});
    console.log(todo);
    todo.name.should.eql('a todo');
    newInstId = todo.id;
    const result = await db.connector.findById('Todo', newInstId);
    result.name.should.eql('a todo');
    result.id.should.eql(todo.id);
  });
});
