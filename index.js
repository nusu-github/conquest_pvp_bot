const {Worker} = require("worker_threads");
const {uniqueNamesGenerator, names} = require('unique-names-generator');

const start = () => {
    const shortName = uniqueNamesGenerator({
        dictionaries: [names]
    });
    const worker_data = new Worker("./worker.js", {
        workerData: `AI_${shortName}`,
    });
    worker_data.on("error", (err) => {
        console.log(err);
    });
};

(() => {
    for (let index = 0; index < 15; index++) {
        start();
    }
})();
