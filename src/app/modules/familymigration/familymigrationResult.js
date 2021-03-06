/* global angular Clipboard _ ga */

var familymigrationModule = angular.module('hod.familymigration')

familymigrationModule.constant('RESULTCODES', {
  PAY_FREQUENCY_CHANGE: 'PAY_FREQUENCY_CHANGE',
  MULTIPLE_EMPLOYERS: 'MULTIPLE_EMPLOYERS',
  UNKNOWN_PAY_FREQUENCY: 'UNKNOWN_PAY_FREQUENCY',
  NOT_ENOUGH_RECORDS: 'NOT_ENOUGH_RECORDS'
})

// #### ROUTES #### //
familymigrationModule.config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {
  // define a route for the results operation
  $stateProvider.state({
    name: 'familymigrationResults',
    url: '/result',
    title: 'Financial Status : Result',
    parent: 'familymigration',
    views: {
      'content@': {
        templateUrl: 'modules/familymigration/familymigrationResult.html',
        controller: 'FamilymigrationResultCtrl'
      }
    }
  })
}])

familymigrationModule.constant('RESULT_TEXT', {
  copybtn: 'Copy to clipboard',
  copiedbtn: 'Copied',
  copysummary: 'The check financial status service confirmed that {{name}} {{passed}} the requirements as the daily closing balance was {{above}} the total funds required.'
})

familymigrationModule.controller('FamilymigrationResultCtrl',
  [
    '$scope',
    '$state',
    '$stateParams',
    'FamilymigrationService',
    'RESULT_TEXT',
    '$timeout',
    '$window',
    'RESULTCODES',
    function (
      $scope,
      $state,
      $stateParams,
      FamilymigrationService,
      RESULT_TEXT,
      $timeout,
      $window,
      RESULTCODES
    ) {
      var state = 'error'
      var res = FamilymigrationService.getLastAPIresponse()
      $window.document.title = 'Result - Income Proving Service'
      $scope.search = FamilymigrationService.getSearch()
      $scope.applicant = FamilymigrationService.getApplicant()
      $scope.partner = FamilymigrationService.getPartner()
      $scope.showJoint = ($scope.partner)
      $scope.haveResult = FamilymigrationService.haveResult()

      $scope.showNewSearchButton = true

      $scope.dFormat = 'dd/MM/yyyy'

      if (!res.status) {
        $state.go('familymigration')
        return
      }

      var summary = FamilymigrationService.getResultSummary()
      $scope.success = summary && summary.passed
      if (summary) {
        $scope.summary = summary
        $scope.showJoint = (summary.individuals && summary.individuals.length > 1)
        $scope.individual = _.first(summary.individuals)
        $scope.outcomeBoxIndividualName = $scope.individual.forename + ' ' + $scope.individual.surname

        if (summary.passed) {
          $scope.success = true
          state = 'passed'
          if (isSelfAssessment(summary.category)) {
            $scope.selfEmployment = true
            $scope.copysummary = 'Check for evidence of current self employment'
            $scope.assessmentEndDate = FamilymigrationService.calculateEndOfTaxYear(summary.assessmentStartDate)
          } else {
            $scope.copysummary = $scope.outcomeBoxIndividualName + ' meets the Income Proving requirement'
          }
        } else {
          $scope.copysummary = $scope.outcomeBoxIndividualName + ' does not meet the Income Proving requirement'
          $scope.success = false
      // $scope.heading = res.data.individual.forename + ' ' + res.data.individual.surname + ' doesn\'t meet the Category A requirement';
          switch (summary.failureReason) {
            case RESULTCODES.PAY_FREQUENCY_CHANGE:
              state = 'notpassed/paymentfrequencychange'
              $scope.reason = 'Change in payment frequency.'
              break

            case RESULTCODES.MULTIPLE_EMPLOYERS:
              state = 'notpassed/multipleemployers'
              $scope.reason = 'Payments from multiple employers.'
              break

            case RESULTCODES.UNKNOWN_PAY_FREQUENCY:
              state = 'notpassed/unknownfrequency'
              $scope.reason = 'Unable to calculate a payment frequency.'
              break

            case RESULTCODES.NOT_ENOUGH_RECORDS:
              state = 'notpassed/recordcount'
              $scope.reason = 'They haven\'t been with their current employer for 6 months.'
              break

            default:
              state = 'notpassed/threshold'
              $scope.reason = 'They haven\'t met the required monthly amount.'
          }
        }
      } else {
        console.log('ERROR', res)
        console.log($scope.applicant)
        $scope.showFeedbackForm = false
        $scope.showFeedbackThanks = false
        if (res.status === 404 && res.data && res.data.status && res.data.status.code === '0009') {
          state = 'failure/norecord'
          var partnerNino = $scope.partner ? $scope.partner.nino : ''
          $scope.heading = 'There is no record for ' + FamilymigrationService.getNotFoundNino(res.data.status.message, $scope.applicant.nino, partnerNino) + ' with HMRC'
          $scope.reason = 'We couldn\'t perform the financial requirement check as no income information exists with HMRC.'
        } else if (res.status === 404) {
          $scope.heading = 'Incoming Proving Service Currently Unavailable'
          $scope.reason = 'The page will now reload.'
          state = 'failure'
          $timeout(function () {
            $window.location.reload()
          }, 2000)
        } else if (res.status === 307 || res.status === 405) {
          $scope.heading = 'Your Income Proving Service session has timed out'
          $scope.reason = 'The page will now reload.'
          state = 'failure'
          $timeout(function () {
            $window.location.reload()
          }, 2000)
        } else {
          $scope.heading = 'You can’t use this service just now. The problem will be fixed as soon as possible'
          $scope.reason = 'Please try again later.'
          state = 'failure'
        }
      };

      $scope.newSearch = function () {
        $window.location.reload()
      }

      $scope.editSearch = function () {
        $state.go('familymigration')
      }

      // track
      ga('set', 'page', $state.href($state.current.name, $stateParams) + '/' + state)
      ga('send', 'pageview')

      $scope.copyToClipboardBtnText = RESULT_TEXT.copybtn

      var copyText = FamilymigrationService.getCopyPasteSummary()
      var clipboard = new Clipboard('.button--copy', {
        text: function () {
          return copyText
        }
      })

      var timeoutResetButtonText = function () {
        $timeout(function () {
          $scope.copyToClipboardBtnText = RESULT_TEXT.copybtn
          $scope.$applyAsync()
        }, 2000)
      }

      function isSelfAssessment (summaryCategory) {
        return summaryCategory === 'F'
      }

      clipboard.on('success', function (e) {
        $scope.copyToClipboardBtnText = RESULT_TEXT.copiedbtn
        $scope.$applyAsync()
        e.clearSelection()
        timeoutResetButtonText()
      })

      clipboard.on('error', function (e) {
        console.log('ClipBoard error', e)
        $scope.copysummary = e.action + ' ' + e.trigger
        $scope.$applyAsync()
      })
    }])
