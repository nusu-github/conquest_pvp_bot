const { Worker } = require('worker_threads')
const { uniqueNamesGenerator, names } = require('unique-names-generator')

const loop_times = 9

const start = () => {
  const shortName = uniqueNamesGenerator({
    dictionaries: [names]
  })
  const worker_data = new Worker('./worker.js', {
    workerData: `AI_${shortName}`
  })
  worker_data.on('error', (err) => {
    console.log(err)
  })
};

(() => { for (let index = 0; index < loop_times; index++) start() })()
