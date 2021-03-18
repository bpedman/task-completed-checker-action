import * as core from '@actions/core'
import * as github from '@actions/github'
import {createTaskListText, removeIgnoreTaskLitsText} from './utils'

const CHECK_NAME = 'Task Completed Check'

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'

async function createOrUpdateCheck(
  githubApi: github.GitHub,
  conclusion: Conclusion,
  summary: string,
  text: string
): Promise<void> {
  const ref = process.env.GITHUB_SHA || ''
  const owner = github.context.repo.owner
  const repo = github.context.repo.repo

  const createResponse = await githubApi.checks.create({
    name: CHECK_NAME,
    // eslint-disable-next-line @typescript-eslint/camelcase
    head_sha: ref,
    status: 'completed',
    conclusion,
    // eslint-disable-next-line @typescript-eslint/camelcase
    completed_at: new Date().toISOString(),
    output: {title: CHECK_NAME, summary, text},
    owner,
    repo
  })

  core.debug(`response code ${createResponse.status}`)
  core.debug(`response ${JSON.stringify(createResponse.data)}`)
  core.debug(`headers ${JSON.stringify(createResponse.headers)}`)

  // const existingChecksResponse = await githubApi.checks.listForRef({
  //   // eslint-disable-next-line @typescript-eslint/camelcase
  //   check_name: CHECK_NAME,
  //   ref,
  //   owner,
  //   repo,
  //   filter: 'latest'
  // })
  //
  // if (
  //   existingChecksResponse.status !== 200 ||
  //   existingChecksResponse.data.total_count <= 0
  // ) {
  //   core.debug('no matching existing check, creating a new one')
  //   core.debug(
  //     `status: ${existingChecksResponse.status} count: ${existingChecksResponse.data.total_count}`
  //   )
  //
  // } else {
  //   const checkRunId = existingChecksResponse.data.check_runs[0].id
  //   core.debug(`found existing check run ID: ${checkRunId}`)
  //   await githubApi.checks.update({
  //     // eslint-disable-next-line @typescript-eslint/camelcase
  //     check_run_id: checkRunId,
  //     status: 'completed',
  //     conclusion,
  //     // eslint-disable-next-line @typescript-eslint/camelcase
  //     completed_at: new Date().toISOString(),
  //     output: {title: CHECK_NAME, summary, text},
  //     owner: github.context.repo.owner,
  //     repo: github.context.repo.repo
  //   })
  // }
}

async function run(): Promise<void> {
  try {
    const body = github.context.payload.pull_request?.body

    const token = core.getInput('repo-token', {required: true})
    const githubApi = new github.GitHub(token)

    if (!body) {
      core.info('no task list and skip the process.')
      await createOrUpdateCheck(
        githubApi,
        'success',
        'No task list',
        'No task list'
      )
      return
    }

    const result = removeIgnoreTaskLitsText(body)

    core.debug('creates a list of tasks which removed ignored task: ')
    core.debug(result)

    const isTaskCompleted = result.match(/([-*] \[[ ]].+)/g) === null
    const text = createTaskListText(result)

    core.debug('creates a list of completed tasks and uncompleted tasks: ')
    core.debug(text)

    const conclusion = isTaskCompleted ? 'success' : 'failure'
    const summary = isTaskCompleted
      ? 'All tasks are completed!'
      : 'Some tasks are uncompleted!'

    await createOrUpdateCheck(githubApi, conclusion, summary, text)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
