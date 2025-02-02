import React, {Component} from 'react'
import _ from 'lodash'
import {InjectedRouter, Link} from 'react-router'
import {connect} from 'react-redux'
import {withSource} from 'src/CheckSources'

import PageSpinner from 'src/shared/components/PageSpinner'

import * as kapacitorRuleActionCreators from 'src/kapacitor/actions/view'
import * as kapacitorQueryConfigActionCreators from 'src/kapacitor/actions/queryConfigs'

import {bindActionCreators} from 'redux'
import {
  getActiveKapacitor,
  getKapacitorConfig,
  getKapacitor,
} from 'src/shared/apis/index'
import {DEFAULT_RULE_ID} from 'src/kapacitor/constants'
import KapacitorRule from 'src/kapacitor/components/KapacitorRule'
import parseHandlersFromConfig from 'src/shared/parsing/parseHandlersFromConfig'
import {notify as notifyAction} from 'src/shared/actions/notifications'

import {
  notifyKapacitorCreateFailed,
  notifyCouldNotFindKapacitor,
} from 'src/shared/copy/notifications'
import {ErrorHandling} from 'src/shared/decorators/errors'

import {
  Source,
  Notification,
  AlertRule,
  QueryConfig,
  Kapacitor,
} from 'src/types'
import {
  KapacitorQueryConfigActions,
  KapacitorRuleActions,
} from 'src/types/actions'
import {Page} from 'src/reusable_ui'

interface Params {
  ruleID: string
  kid?: string
}

interface Props {
  source: Source
  notify: (notification: Notification) => void
  rules: AlertRule[]
  queryConfigs: QueryConfig[]
  ruleActions: KapacitorRuleActions
  queryConfigActions: KapacitorQueryConfigActions
  params: Params
  router: InjectedRouter
}

interface State {
  handlersFromConfig: any[]
  kapacitor: Kapacitor | Record<string, never>
}

@ErrorHandling
class KapacitorRulePage extends Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      handlersFromConfig: [],
      kapacitor: {},
    }
  }

  public async componentDidMount() {
    const {params, source, ruleActions, notify} = this.props

    if (params.ruleID === 'new') {
      ruleActions.loadDefaultRule()
    } else {
      ruleActions.fetchRule(source, params.ruleID)
    }
    let kapacitor: Kapacitor
    if (params.kid) {
      kapacitor = await getKapacitor(this.props.source, params.kid)
    } else {
      kapacitor = await getActiveKapacitor(source)
    }
    if (!kapacitor) {
      return notify(notifyCouldNotFindKapacitor())
    }

    try {
      const kapacitorConfig = await getKapacitorConfig(kapacitor)
      const handlersFromConfig = parseHandlersFromConfig(kapacitorConfig)
      this.setState({kapacitor, handlersFromConfig})
    } catch (error) {
      notify(notifyKapacitorCreateFailed())
      console.error(error)
      throw error
    }
  }

  public render() {
    const {
      params,
      source,
      router,
      ruleActions,
      queryConfigs,
      queryConfigActions,
    } = this.props
    const {handlersFromConfig, kapacitor} = this.state
    const rule = this.rule
    const query = rule && queryConfigs[rule.queryID]

    if (rule && rule['template-id'] && kapacitor) {
      return (
        <Page>
          <Page.Contents>
            <div>
              This rule was created from a template. It cannot be edited in
              chronograf, see its{' '}
              <Link
                to={`sources/${source.id}/kapacitors/${kapacitor.id}/tickscripts/${rule.id}`}
              >
                TICKScript
              </Link>
              .
            </div>
          </Page.Contents>
        </Page>
      )
    }
    if (!query) {
      return <PageSpinner />
    }

    return (
      <KapacitorRule
        source={source}
        rule={rule}
        query={query}
        queryConfigs={queryConfigs}
        queryConfigActions={queryConfigActions}
        ruleActions={ruleActions}
        handlersFromConfig={handlersFromConfig}
        ruleID={params.ruleID}
        router={router}
        kapacitor={kapacitor}
        configLink={`/sources/${source.id}/kapacitors/${this.kapacitorID}/edit`}
      />
    )
  }

  private get kapacitorID(): string {
    const {kapacitor} = this.state
    return _.get(kapacitor, 'id')
  }

  private get rule(): AlertRule {
    const {params, rules} = this.props
    const ruleID = _.get(params, 'ruleID')

    if (ruleID === 'new') {
      return rules[DEFAULT_RULE_ID]
    }

    return rules[params.ruleID]
  }
}

const mapStateToProps = ({rules, kapacitorQueryConfigs: queryConfigs}) => ({
  rules,
  queryConfigs,
})

const mapDispatchToProps = dispatch => ({
  ruleActions: bindActionCreators(kapacitorRuleActionCreators, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
  queryConfigActions: bindActionCreators(
    kapacitorQueryConfigActionCreators,
    dispatch
  ),
})

export default withSource(
  connect(mapStateToProps, mapDispatchToProps)(KapacitorRulePage)
)
