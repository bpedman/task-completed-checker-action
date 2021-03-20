import * as core from '@actions/core'
import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'
import {createTaskListText, removeIgnoreTaskLitsText} from './utils'

const CHECK_NAME = 'Tasks Completed Check'

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'

async function createCheck(
  githubApi: InstanceType<typeof GitHub>,
  conclusion: Conclusion,
  summary: string,
  text: string
): Promise<void> {
  const ref = github.context.payload.pull_request?.head.sha
  const owner = github.context.repo.owner
  const repo = github.context.repo.repo

  const createResponse = await githubApi.checks.create({
    name: CHECK_NAME,
    head_sha: ref,
    status: 'completed',
    conclusion,
    completed_at: new Date().toISOString(),
    output: {title: CHECK_NAME, summary, text},
    owner,
    repo
  })

  if (createResponse.status !== 201) {
    core.setFailed(
      `Error creating status check, response was ${
        createResponse.status
      } with data ${JSON.stringify(createResponse.data)}`
    )
  }
}

async function run(): Promise<void> {
  try {
    const body = github.context.payload.pull_request?.body

    const token = core.getInput('repo-token', {required: true})
    const githubApi = github.getOctokit(token)

    if (!body) {
      core.info('no task list present, skipping')
      await createCheck(githubApi, 'success', 'No task list', 'No task list')
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

    await createCheck(githubApi, conclusion, summary, text)

    if (isTaskCompleted) {
      core.info(summary)
    } else {
      core.setFailed(summary)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
