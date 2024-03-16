var mysql = require('mysql2');
var db_info = {
    host: 'project-db-stu.ddns.net',
    port: '3307',
    user: 'toprospect',
    password: 'toprospect',
    database: 'toprospect'
}

module.exports = {
    init: function () {
        return mysql.createConnection(db_info);
    },
    connect: function(conn) {
        conn.connect(function(err) {
            if(err) console.error('mysql connection error : ' + err);
            else console.log('mysql 연결 성공!');
        });
    }
}