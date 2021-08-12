const config = require('../config.json');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.align(),
    winston.format.printf(info => `${info.timestamp} [${info.level}]: ${info.message}`)
);

var logger = winston.createLogger({
    format: logFormat,
    transports: [
        new DailyRotateFile({
            level: config.debug ? 'debug' : 'info',
            dirname: config.log_folder,
            filename: config.log_file,
            datePattern: 'YYYY-MM-DD',
            maxFiles: '14d',
        }),
        new winston.transports.Console({
            level: config.debug ? 'debug' : 'info'
        })
    ]
});

module.exports = logger;