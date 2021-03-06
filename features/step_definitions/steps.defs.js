const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const expect = chai.expect
const _ = require('underscore')
const seleniumWebdriver = require('selenium-webdriver')
const until = seleniumWebdriver.until
const By = seleniumWebdriver.By
const {defineSupportCode} = require('cucumber')
const mockdata = require('./mockdata')
const request = require('request')
chai.use(chaiAsPromised)

const urls = {
  financialstatus: 'incomeproving/v3/individual/financialstatus'
}

const radioElements = {
  correctIndividual: [{
    key: 'yes',
    value: 'Yes'
  },
  {
    key: 'no',
    value: 'No'
  }],
  match: [{
    key: 'yes',
    value: 'Yes'
  },
  {
    key: 'no',
    value: 'No'
  }]

}

const getHttp = function (uri) {
  return new Promise(function (resolve, reject) {
    request({uri: uri}, function (error, response, body) {
      const statusCode = (response && response.statusCode) ? response.statusCode : 500
      if (error) {
        return reject({status: statusCode, error: error, body: body})
      }
      return resolve({status: statusCode, error: error, body: body})
    })
  })
}

const whenAllDone = function (promises) {
  let counter = 0
  const errors = []
  const results = []

  return new Promise(function (resolve, reject) {
    const done = function () {
      counter++
      if (counter >= promises.length) {
        if (errors.length) {
          return reject(errors)
        } else {
          return resolve(results)
        }
      }
    }
    _.each(promises, function (p) {
      p.then(function (result) {
        results.push(result)
        done()
      }, function (err) {
        errors.push(err)
        done()
      })
    })
  })
}

const justWait = function (howLong) {
  return new Promise(function (resolve, reject) {
    setTimeout(resolve, howLong)
  })
}

const isRadio = function (key) {
  return (_.keys(radioElements).indexOf(key) >= 0)
}

const toCamelCase = function (str) {
  return str.toLowerCase().replace(/(?:^\w|-|\b\w)/g, function (letter, index) {
    return (index === 0 || str.substr(index - 1, 1) === '-') ? letter.toLowerCase() : letter.toUpperCase()
  }).replace(/\s+/g, '')
}

const toCamelCaseKeys = function (data) {
  const result = {}
  _.each(data, function (val, key) {
    result[toCamelCase(key)] = val
  })
  return result
}

const waitFind = function (d, what) {
  return d.wait(until.elementLocated(what), 5 * 1000, 'TIMEOUT: Waiting for element #' + JSON.stringify(what, null, '  '))
}

const confirmContentById = function (d, data, timeoutLength) {
  var e
  const promises = []
  _.each(data, function (val, key) {
    const expectation = new Promise(function (resolve, reject) {
      // d.wait(until.elementLocated({id: key}), timeoutLength || 5 * 1000, 'TIMEOUT: Waiting for element #' + key).then(function (el) {
      waitFind(d, {id: key}).then(function (el) {
        e = el
        return el.getTagName()
      }).then(function (name) {
        if (name === 'input') {
          return expect(e.getAttribute('value')).to.eventually.equal(val)
        } else {
          return expect(e.getText()).to.eventually.equal(val)
        }
      }).then(function (result) {
        return resolve(result)
      }, function (err) {
        // test failed
        console.log('FAILED', key, val)
        return reject(err)
      })
    })
    promises.push(expectation)
  })
  return whenAllDone(promises)
}

const confirmVisible = function (d, data, visibility, timeoutLength) {
  const promises = []
  _.each(data, function (val, key) {
    const expectation = new Promise(function (resolve, reject) {
      d.wait(until.elementLocated({id: key}), timeoutLength || 1 * 1000, 'TIMEOUT: Waiting for element #' + key).then(function (el) {
        return el.isDisplayed()
      }).then(function (result) {
        if (result === !!visibility) {
          return resolve(result)
        } else {
          return reject()
        }
      }, function (err) {
        // test failed
        if (visibility === false) {
          return resolve(true)
        } else {
          return reject(err)
        }
      })
    })
    promises.push(expectation)
  })
  return whenAllDone(promises)
}

const confirmInputValuesById = function (d, data) {
  const promises = []
  let xpath
  let expectation
  _.each(data, function (val, key) {
    if (isRadio(key)) {
      const theRadio = _.findWhere(radioElements[key], {value: val})
      xpath = '//input[@id="' + key + '-' + theRadio.key + '"]'
      expectation = d.wait(until.elementLocated({xpath: xpath}), 1000, 'TIMEOUT: Waiting for element ' + xpath).then(function (el) {
        return expect(el.isSelected()).to.eventually.equal(true)
      })
    } else {
      expectation = new Promise(function (resolve, reject) {
        xpath = '//input[@id="' + key + '"]'
        expectation = d.wait(until.elementLocated({xpath: xpath}), 1000, 'TIMEOUT: Waiting for element ' + xpath).then(function (el) {
                    // wait until driver has located the element
          return el.getAttribute('value')
        }).then(function (elValue) {
          if (_.isNaN(Number(elValue)) || _.isNaN(Number(val))) {
            return expect(elValue).to.equal(val)
          }
          return expect(Number(elValue)).to.equal(Number(val))
        }).then(function (result) {
          return resolve(result)
        }, function (err) {
          return reject(err)
        })
      })
    }
    promises.push(expectation)
  })
  return whenAllDone(promises)
}

const expandFields = function (obj) {
  let bits

  const splitDates = function (o, key) {
    if (o[key] || o.key === '') {
      bits = o[key].split('/')
      o[key + 'Day'] = bits[0]
      o[key + 'Month'] = bits[1] || ''
      o[key + 'Year'] = bits[2] || ''
      delete o[key]
    }
    return o
  }

  _.each(['dateOfBirth', 'applicationRaisedDate', 'partnerDateOfBirth'], function (key) {
    obj = splitDates(obj, key)
  })

  return obj
}

const selectRadio = function (d, key, val) {
  const rID = key + '-' + val.toLowerCase() + '-label'
  return d.findElement({id: rID}).then(function (el) {
    return el.click()
  }).then(function (result) {
    return true
  }, function () {
    return false
  })
}

const clickCheckbox = function (d, key) {
  const rID = key + '-label'
  return d.findElement({id: rID}).then(function (el) {
    return el.click()
  }).then(function (result) {
    return true
  }, function () {
    return false
  })
}

const inputEnterText = function (d, key, val) {
  var el
  return d.findElement({id: key}).then(function (e) {
    el = e
    return e.getAttribute('type')
  }).then(function (t) {
    if (t === 'checkbox') {
      return clickCheckbox(d, key)
    }
    return el.sendKeys(val)
  }).then(function (result) {
    return true
  }, function () {
    return true
  })
}

const completeInput = function (d, key, val) {
  if (isRadio(key)) {
    return selectRadio(d, key, val)
  }

  return inputEnterText(d, key, val)
}

const completeInputs = function (d, data) {
  const promises = []
  _.each(data, function (val, key) {
    promises.push(completeInput(d, key, val))
  })
  return whenAllDone(promises)
}

const submitAction = function (d) {
  return d.findElement({className: 'button'}).then(function (btn) {
    return btn.click()
  }).then(function (clicked) {
    return seleniumWebdriver.until.elementLocated({id: 'outcome'})
  }).then(function (foundit) {
    return justWait(200)
  })
}

// const getTableHeaders = function (d, id) {
//   return d.wait(until.elementLocated({id: id}), 5 * 1000, 'TIMEOUT: Waiting for element #' + id).then(function () {
//         // wait until driver has located the element
//     const selector = '#' + id + ' th'
//     return d.findElements(By.css(selector))
//   }).then(function (headers) {
//     const promises = []
//     _.each(headers, function (el) {
//       promises.push(el.getText())
//     })
//     return whenAllDone(promises)
//   }, function (err) {

//   })
// }

defineSupportCode(function ({Given, When, Then}) {
  Given(/the api is unreachable/, function (callback) {
    mockdata.stubHealthz(503)
    mockdata.stubIt(urls.financialstatus, '', 404)
    callback()
  })

  Given(/the api response is empty/, function (callback) {
    mockdata.stubIt(urls.financialstatus, '', 200)
    callback()
  })

  Given(/^the api health check response has status (\d+)$/, function (int, callback) {
    mockdata.stubHealthz(int)
    callback()
  })

  Given(/the api response is delayed for (\d+) seconds/, {timeout: -1}, function (int, callback) {
    mockdata.stubItFile(urls.financialstatus, 'notfoundRK123456C.json', 200, int * 1000)
    callback()
  })

  Given(/the api response is garbage/, function (callback) {
    mockdata.stubHealthz(503)
    mockdata.stubIt(urls.financialstatus, '', 500)
    callback()
  })

  Given(/the api response has status (\d+)/, function (int, callback) {
    mockdata.stubIt(urls.financialstatus, '', int)
    callback()
  })

  Given(/Caseworker is using the Income Proving Service Case Worker Tool/, {timeout: 10 * 1000}, function () {
    const d = this.driver

    return d.get('http://127.0.0.1:8000/#!/familymigration/').then(function () {
      return d.navigate().refresh()
    }).then(function () {
      const el = d.findElement({id: 'pageTitle'})
      return expect(el.getText()).to.eventually.equal('Income Proving Service\nFamily Migration')
    })
  })

  Given(/^the account data for ([0-9_a-zA-Z]+)$/, function (nino, callback) {
    mockdata.stubItFile(urls.financialstatus, nino + '.json', 200)
    callback()
  })

  Given(/^no record for ([0-9a-zA-Z]+)$/, function (nino, callback) {
    mockdata.stubItFile(urls.financialstatus, 'notfound' + nino + '.json', 404)
    callback()
  })

  Given(/^the income check is performed$/, {timeout: 10 * 1000}, function () {
    const d = this.driver
    const data = expandFields(this.defaults)
    return completeInputs(d, data).then(function () {
      return submitAction(d)
    })
  })

  Given(/^the form is filled in$/, {timeout: 10 * 1000}, function (tableOrCallback) {
    const d = this.driver
    if (typeof tableOrCallback === 'function') {
      completeInputs(d, expandFields(this.defaults)).then(function () {
        tableOrCallback()
      })
    } else {
      const data = expandFields(_.defaults(toCamelCaseKeys(_.object(tableOrCallback.rawTable)), this.defaults))
      return completeInputs(d, data)
    }
  })

  Given(/^the api response is a validation error - (.+) parameter$/, function (ref, callback) {
    mockdata.stubItFile(urls.financialstatus, 'validation-error-' + ref + '.json', 400)
    callback()
  })

  Given(/the default details are/, function (table) {
    this.defaults = toCamelCaseKeys(_.object(table.rawTable))
    return true
  })

  When(/^([a-zA-Z]+) submits a query$/, {timeout: 10 * 1000}, function (name, tableOrCallback) {
    const d = this.driver
    if (typeof tableOrCallback === 'function') {
      completeInputs(d, expandFields(this.defaults)).then(function () {
        return submitAction(d)
      }).then(tableOrCallback())
    } else {
      const data = expandFields(_.defaults(toCamelCaseKeys(_.object(tableOrCallback.rawTable)), this.defaults))
      return completeInputs(d, data).then(function () {
        return submitAction(d)
      })
    }
  })

  Then(/^the service displays the following result$/, function (table) {
    const data = toCamelCaseKeys(_.object(table.rawTable))
    return confirmContentById(this.driver, data)
  })

  When(/^the (.+) (button|link) is clicked$/, function (btnRef, btnOrLink) {
    return this.driver.findElement({id: toCamelCase(btnRef) + 'Btn'}).click().then(function () {
      return justWait(50)
    })
  })

  Then(/the inputs will be populated with/, function (table) {
    const data = expandFields(toCamelCaseKeys(_.object(table.rawTable)))
    return confirmInputValuesById(this.driver, data)
  })

  Then(/the liveness response status should be (\d+)/, function (int) {
    return getHttp('http://localhost:8000/ping').then(function (result) {
      return expect(result.status).to.equal(int)
    }, function (error) {
      return expect(error.status).to.equal(int)
    })
  })

  Then(/the readiness response status should be (\d+)/, function (int) {
    return getHttp('http://localhost:8000/healthz').then(function (result) {
      return expect(result.status).to.equal(int)
    }, function (error) {
      return expect(error.status).to.equal(int)
    })
  })

  Then(/^the service displays the following page content within (\d+) seconds$/, {timeout: 40000}, function (int, table) {
    const data = toCamelCaseKeys(_.object(table.rawTable))
    return confirmContentById(this.driver, data, int * 1000)
  })

  Then(/^the service displays the following page content$/, function (table) {
    const data = toCamelCaseKeys(_.object(table.rawTable))
    return confirmContentById(this.driver, data)
  })

  Then(/^the following are (visible|hidden)$/, function (showOrHide, table) {
    const data = toCamelCaseKeys(_.object(table.rawTable))
    return confirmVisible(this.driver, data, (showOrHide === 'visible'))
  })

  const loadTable = (driver, tableRef) => {
    return new Promise((resolve, reject) => {
      let xpath = `//*[@id="${tableRef}"]/tbody/tr`
      let trPromises = []
      driver.findElements(By.xpath(xpath)).then(trs => {
        _.each(trs, tr => {
          trPromises.push(loadCells(tr))
        })

        whenAllDone(trPromises).then(results => {
          return resolve(results)
        })
      })
    })
  }

  const loadCells = (trElem) => {
    return new Promise((resolve, reject) => {
      let cellPromises = []
      trElem.findElements(By.xpath('.//th|td')).then(cells => {
        _.each(cells, c => {
          cellPromises.push(c.getText())
        })

        whenAllDone(cellPromises).then(results => {
          return resolve(results)
        })
      })
    })
  }

  Then(/^the service displays the following ([a-z]+) table$/i, function (tableRef, table) {
    const rawData = table.rawTable
    const data = []
    _.each(rawData, (row) => {
      if (row[0] === '' && data.length) {
        _.last(data)[1] += '\n' + row[1]
      } else {
        data.push(row)
      }
    })

    return loadTable(this.driver, tableRef + 'Table').then(results => {
      _.each(results, (row, i) => {
        _.each(row, (cell, j) => {
          expect(data[i][j]).to.equal(cell)
        })
      })
    })
  })
})
