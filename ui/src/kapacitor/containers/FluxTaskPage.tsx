import React, {FC, useEffect, useState} from 'react'
import FluxScriptEditor from 'src/flux/components/FluxScriptEditor'
import {ComponentColor, Page, Radio} from 'src/reusable_ui'

import {getActiveKapacitor, getKapacitor} from 'src/shared/apis'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import PageSpinner from 'src/shared/components/PageSpinner'

import {Source, Kapacitor, FluxTask, LogItem} from 'src/types'
import {getFluxTask, getFluxTaskLogs} from '../apis'
import LogsTableRow from '../components/LogsTableRow'

interface Params {
  taskID: string
  kid?: string // kapacitor id
}

interface Props {
  source: Source
  params: Params
  router: {
    push: (path: string) => void
  }
}

const noop = () => undefined
const numLogsToRender = 200

const LogsTable: FC<{task: FluxTask; kapacitor: Kapacitor}> = ({
  task,
  kapacitor,
}) => {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<LogItem[] | undefined>(undefined)
  useEffect(() => {
    setLoading(true)
    const fetchData = async () => {
      try {
        const lastLogs = await getFluxTaskLogs(
          kapacitor,
          task.id,
          numLogsToRender
        )
        if (!lastLogs) {
          setLogs([
            {
              id: 'nologs',
              key: 'nologs',
              service: '',
              lvl: 'info',
              ts: new Date().toISOString(),
              msg: 'No Logs available',
              tags: '',
            },
          ])
        }
        setLogs(lastLogs)
      } catch (e) {
        console.error(e)
        setLogs([
          {
            id: 'nologs',
            key: 'nologs',
            service: '',
            lvl: 'error',
            ts: new Date().toISOString(),
            msg: e?.data?.message
              ? e.data.message
              : `Cannot load flux task logs: ${e}`,
            tags: '',
          },
        ])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [task, kapacitor])
  if (loading) {
    return (
      <div className="panel panel-solid">
        <div className="panel-body">
          <PageSpinner />
        </div>
      </div>
    )
  }

  return (
    <div className="logs-table">
      <div className="logs-table--header">
        {`${numLogsToRender} Most Recent Logs`}
      </div>
      <FancyScrollbar
        autoHide={false}
        className="logs-table--container fancy-scroll--kapacitor"
      >
        {logs.map(log => (
          <LogsTableRow key={log.key} logItem={log} />
        ))}
      </FancyScrollbar>
    </div>
  )
}

const FluxTaskPage: FC<Props> = ({source, params: {taskID, kid}, router}) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(undefined)
  const [[kapacitor, task], setData] = useState<
    [Kapacitor | undefined, FluxTask | undefined]
  >([undefined, undefined])
  const [areLogsVisible, setLogsVisible] = useState<boolean>(false)
  useEffect(() => {
    setLoading(true)
    const fetchData = async () => {
      try {
        let kapa: Kapacitor
        if (kid) {
          kapa = await getActiveKapacitor(source)
        } else {
          kapa = await getKapacitor(source, kid)
        }
        if (!kapa) {
          setError(new Error('Kapacitor not found!'))
          return
        }
        const taskVal = await getFluxTask(kapa, taskID)
        if (!taskVal) {
          setError(new Error(`Task identified by ${taskID} not found!`))
          return
        }
        setData([kapa, taskVal])
      } catch (e) {
        console.error(e)
        setError(
          new Error(
            e?.data?.message ? e.data.message : `Cannot load flux task: ${e}`
          )
        )
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [kid, taskID])

  let contents = null
  if (error) {
    contents = <p className="unexpected_error">{error.toString()}</p>
  } else if (loading) {
    contents = (
      <div className="panel panel-solid">
        <div className="panel-body">
          <PageSpinner />
        </div>
      </div>
    )
  } else if (task) {
    contents = (
      <>
        <div className="fluxtask-controls">
          {task.name} <i>{task.status}</i>
        </div>
        <div className="fluxtask-editor">
          <FluxScriptEditor
            onChangeScript={noop}
            onSubmitScript={noop}
            onCursorChange={noop}
            suggestions={[]}
            status={{text: '', type: 'success'}}
            script={task.flux}
            visibility="visible"
            readOnly={true}
          />
        </div>
      </>
    )
  }

  return (
    <Page className="tickscript-editor-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="Flux Task" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true}>
          <Radio color={ComponentColor.Success}>
            <Radio.Button
              id="tickscript-logs--hidden"
              active={!areLogsVisible}
              value={false}
              onClick={setLogsVisible}
              titleText="Show just the Flux Task Script"
            >
              Script
            </Radio.Button>
            <Radio.Button
              id="tickscript-logs--visible"
              active={areLogsVisible}
              value={true}
              onClick={setLogsVisible}
              titleText="Show the Flux Task Script & Logs"
            >
              Script + Logs
            </Radio.Button>
          </Radio>
          <button
            className="btn btn-default btn-sm"
            title="Return to Tasks"
            onClick={() => {
              router.push(`/sources/${source.id}/alert-rules`)
            }}
          >
            Exit
          </button>
        </Page.Header.Right>
      </Page.Header>
      <div className="page-contents--split">
        <div
          className="fluxtask"
          style={{maxWidth: areLogsVisible ? '50%' : '100%'}}
        >
          {contents}
        </div>
        {areLogsVisible ? (
          <LogsTable task={task} kapacitor={kapacitor} />
        ) : null}
      </div>
    </Page>
  )
}

export default FluxTaskPage
