/*
 * @author Goran Opacic <@goranopacic>
 * @version 1.0.0
 * @license MIT
 */
const AWS = require("aws-sdk");
const RDS = new AWS.RDS();
const RDSDATA = new AWS.RDSDataService();

AWS.config.update({
  maxRetries: 10,
  httpOptions: {
    timeout: 60000,
    connectTimeout: 60000
  }
});

/**********************************************************************/
/** Enable HTTP Keep-Alive per https://vimeo.com/287511222          **/
/** This dramatically increases the speed of subsequent HTTP calls  **/
/** From Jeremy Daly's data-api-client lib
/** https://github.com/jeremydaly/data-api-client/index.js          **/
/**********************************************************************/
const https = require("https");
const sslAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50, // same as aws-sdk
  rejectUnauthorized: true // same as aws-sdk
});
sslAgent.setMaxListeners(0); // same as aws-sdk

exports.handler = async function(event) {
  try {
    console.log("START");
    console.log("ENV SECRETARN: " + process.env.SECRETARN);
    console.log("ENV DBCLUSTERARN: " + process.env.DBCLUSTERARN);
    console.log("ENV DBCLUSTERID: " + process.env.DBCLUSTERID);

    var action = "hi";

    if (event.queryStringParameters && event.queryStringParameters.action) {
      action = event.queryStringParameters.action;
    }

    if (action == "test") {
      var params = {
        DBClusterIdentifier: process.env.DBCLUSTERID
      };
      var res = await RDS.describeDBClusters(params).promise();

      var serverStatus = "DOWN";
      if (res.DBClusters[0].Capacity > 0) {
        serverStatus = "UP";
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: `<html><body>Hi! This is path ${event.path} STATUS: ${serverStatus} Capacity: ${res.DBClusters[0].Capacity} </body></html>\n`
      };
    } else if (action == "warmup") {
      const params = {
        secretArn: process.env.SECRETARN,
        resourceArn: process.env.DBCLUSTERARN,

        sql: `select 1`
      };

      var start = new Date();

      const MAXRETRIES = 10;
      var data1;
      var cnt = 1;
      do {
        var retry = false;
        console.log("CNT: " + cnt);

        var startQuery = new Date();
        try {
          data1 = await RDSDATA.executeStatement(params).promise();
        } catch (e) {
          console.log("E " + JSON.stringify(e));
          console.log(
            "Exception " + e + " with params: " + JSON.stringify(params)
          );

          if (
            e.code == "BadRequestException" &&
            e.message.startsWith("Communications link failure")
          ) {
            console.log("BadRequestException " + JSON.stringify(e));
            var paramsDbCluster = {
              DBClusterIdentifier: process.env.DBCLUSTERID
            };
            var res = await RDS.describeDBClusters(paramsDbCluster).promise();
            console.log(
              "Current DBCluster Capacity: " + res.DBClusters[0].Capacity
            );

            retry = true;
          } else {
            throw e;
          }
        }
        var endQuery = new Date() - startQuery;
        console.log(
          "ATTEMPT: " + cnt + " Query total Execution time: %dms",
          endQuery
        );
      } while (retry && cnt++ < MAXRETRIES);

      var end = new Date() - start;
      console.log("Aurora Total Execution time: %dms", end);

      console.log(JSON.stringify(data1, null, 2));
      var tabledata = JSON.stringify(data1, null, 2);

      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: `<html><body>ACTION ${action} This is path ${event.path} here is your data ${tabledata}</body></html>\n`
      };
    } else if (action == "hi") {
      console.log("hi");
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: `<html><body>Hi! This is path ${event.path} </body></html>\n`
      };
    } else if (action == "init") {
      const params1 = {
        secretArn: process.env.SECRETARN,
        resourceArn: process.env.DBCLUSTERARN,
        sql: `CREATE DATABASE demodb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      };
      let data1 = await RDSDATA.executeStatement(params1).promise();

      const params2 = {
        secretArn: process.env.SECRETARN,
        resourceArn: process.env.DBCLUSTERARN,
        sql: `CREATE table demodb.demotable(id BIGINT AUTO_INCREMENT, demoname VARCHAR(255), demodate DATETIME, PRIMARY KEY (id))`
      };
      let data2 = await RDSDATA.executeStatement(params2).promise();

      const params3 = {
        secretArn: process.env.SECRETARN,
        resourceArn: process.env.DBCLUSTERARN,
        sql: `INSERT INTO demodb.demotable(demoname,demodate) VALUES (:name,:date)`,
        parameters: [
          {
            name: "date",
            value: {
              stringValue: "2019-08-18 01:01:01"
            }
          },
          {
            name: "name",
            value: {
              stringValue: "Welcome"
            }
          }
        ]
      };
      let data3 = await RDSDATA.executeStatement(params3).promise();
      var responsedata = JSON.stringify(data3, null, 2);

      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: `<html><body>ACTION ${action} This is path ${event.path} here is your response ${responsedata}</body></html>\n`
      };
    } else if (action == "select") {
      const params = {
        secretArn: process.env.SECRETARN,
        resourceArn: process.env.DBCLUSTERARN,
        includeResultMetadata: true,
        sql: `select * from demotable`,
        database: "demodb"
      };

      var data1 = await RDSDATA.executeStatement(params).promise();
      var tabledata = JSON.stringify(data1, null, 2);

      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: `<html><body>ACTION ${action} This is path ${event.path} here is your data ${tabledata}</body></html>\n`
      };
    } else if (action == "batch") {
      const params3 = {
        secretArn: process.env.SECRETARN,
        resourceArn: process.env.DBCLUSTERARN,
        database: "demodb",
        sql: `INSERT INTO demotable(demoname,demodate) VALUES (:name,:date)`,
        parameterSets: [
          [
            {
              name: "name",
              value: {
                stringValue: "John"
              }
            },
            {
              name: "date",
              value: {
                stringValue: "2019-08-19"
              }
            }
          ],
          [
            {
              name: "name",
              value: {
                stringValue: "Peter"
              }
            },
            {
              name: "date",
              value: {
                stringValue: "2019-08-20"
              }
            }
          ]
        ]
      };
      let data4 = await RDSDATA.batchExecuteStatement(params3).promise();

      var tabledata = JSON.stringify(data4, null, 2);

      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: `<html><body>ACTION ${action} This is path ${event.path} here is your response ${tabledata}</body></html>\n`
      };
    } else if (action == "transaction") {
      //START THE TRANSACTION
      let paramsTransaction = {
        secretArn: process.env.SECRETARN,
        resourceArn: process.env.DBCLUSTERARN,
        database: "demodb"
      };
      let transData = await RDSDATA.beginTransaction(
        paramsTransaction
      ).promise();
      transId = transData.transactionId;

      const params1 = {
        secretArn: process.env.SECRETARN,
        resourceArn: process.env.DBCLUSTERARN,
        sql: `INSERT INTO demotable(demoname) VALUES('NAME1')`,
        database: "demodb",
        transactionId: transId
      };
      let data1 = await RDSDATA.executeStatement(params1).promise();
      const autogeneratedID = data1.generatedFields[0].longValue;

      var name2 = "NAME2 after " + autogeneratedID;
      const params2 = {
        secretArn: process.env.SECRETARN,
        resourceArn: process.env.DBCLUSTERARN,
        sql: `INSERT INTO demotable(demoname) VALUES('${name2}')`,
        database: "demodb",
        transactionId: transId
      };

      let data2 = await RDSDATA.executeStatement(params2).promise();

      // commit transaction
      let paramsCommitTransaction = {
        secretArn: process.env.SECRETARN,
        resourceArn: process.env.DBCLUSTERARN,
        transactionId: transId
      };

      let commitData = await RDSDATA.commitTransaction(
        paramsCommitTransaction
      ).promise();
      var tabledata = JSON.stringify(commitData, null, 2);
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: `<html><body>ACTION ${action} This is path ${event.path} here is your response ${tabledata}</body></html>\n`
      };
    }

    //END IF action
  } catch (e) {
    console.log(e);
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `<html><body>Exception ${e} You've hit ${event.path} </body></html>\n`
    };
  }
};
