// 설치한 express 모듈 불러오기
var express = require('express');
// express 객체 생성
var app = express();
var db_config = require(__dirname + '/config/database.js');
var conn = db_config.init();
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// echarts
const echarts = require('echarts');

db_config.connect(conn);

// POST 요청 본문을 파싱하기 위한 미들웨어 설정 및 public 사용
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }));


// HTTP 요청의 body에서 JSON 형식으로 전송된 데이터를 파싱(parsing)하여 JavaScript 객체로 만들어주는 역할 
app.use(bodyParser.json());


// EJS 템플릿 엔진 설정
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');


// 쿠키 파서와 세션 설정
app.use(cookieParser());
app.use(session({
    secret: 'topsecret',
    resave: false, // 세션을 언제나 저장할지 설정함
    saveUninitialized: true, // 세션에 저장할 내역이 없더라도 처음부터 세션을 생성할지 설정
    cookie: { secure: false },
}));


// 메인화면 로딩해주는 코드, 닉네임 세션에 값이 있을시 member테이블의 값들을 세션에 저장후 로딩 
app.get('/', function (req, res) {
    if (req.session.memNick) {
        res.render('home', { memId: req.session.memId, memNick: req.session.memNick, memSex: req.session.memSex, memAge: req.session.memAge });
    } else {
        res.render('home', { memId: null, memNick: null, memSex: null, memAge: null });
    }
});


// 중복 아이디
app.post('/checkid', function (req, res) {
    var user = req.body.user;
    var sql = "SELECT * FROM Member WHERE memId = ?";
    conn.query(sql, [user], function (err, result) {
        if (result.length > 0) {
            console.log(result.length);
            res.send("not available");
        } else {
            console.log(result.length);
            res.send("available");
        }
    });
});


// 회원가입 데이터를 MySQL에 저장하는 라우트
app.post('/register', (req, res) => {
    console.log('req body 내용 : ', req.body)
    const confirmPass = req.body['confirm-pass'];

    // 객체 비구조 할당 
    const { user, pass, nick, gender, birth } = req.body


    // 만 나이 계산
    const today = new Date();
    const birthDate = new Date(birth);

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDat+e() < birthDate.getDate())) {
        age--;
    }

    console.log('user data :', user, pass, nick, gender, birth)

    // 비밀번호와 비밀번호 확인이 일치하는지 확인
    if (pass !== confirmPass) {
        return;
    } else {
        // MySQL 쿼리 실행
        const selectSql = 'SELECT * FROM Member WHERE memId = ?';
        const sql = 'INSERT INTO Member (memId, memPwd, memNick, memSex, memAge) VALUES (?, ?, ?, ?, ?)';
        conn.query(selectSql, [user], (error, results) => {
            console.log('result : ', results)
            if (error) {
                console.error(error);
                return;
            } else {
                // 이미 존재하는 아이디가 있는경우
                if (results.length > 0) {
                    res.send({
                        success: false,
                        message: '이미 존재하는 아이디입니다.'
                      });
                    return;
                } else {
                    // 존재하지 않는 아이디인 경우, INSERT문 실행
                    conn.query(sql, [user, pass, nick, gender, age], (error, results) => {
                        if (error) {
                            console.error(error);
                            return;
                        } else {
                            console.log(results);
                            res.send({
                                success: true,
                                message: '회원가입 성공'
                              });
                        }
                    });
                }
            }
        });
    }
});


// 로그인 유지 및 일치여부
app.post('/login', (req, res) => {
    const pass = req.body['lpass'];
    const user = req.body['luser'];
  
    // MySQL 쿼리 실행
    const sql = 'SELECT * FROM Member WHERE memId=?';
    conn.query(sql, [user], (error, results) => {
        if (results.length == 0) {
            // 아이디가 DB에 없을 경우
            res.send({
            success: false,
            message: '존재하지 않는 아이디입니다.'
            });
            return;
        } else if (results[0].memPwd !== pass) {
            // 아이디는 있지만 비밀번호가 일치하지 않을 경우
            res.send({
            success: false,
            message: '비밀번호가 일치하지 않습니다.'
            });
            return;
        }
  
        // 세션에 회원정보 저장
        const { memId, memNick, memSex, memAge } = results[0];
        req.session.memId = memId;
        req.session.memNick = memNick;
        req.session.memSex = memSex;
        req.session.memAge = memAge;
  
        res.send({
            success: true,
            message: '로그인 성공'
        });
    });
});


// 로그아웃
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});


// 채팅 기능 구현
app.post('/chat', (req, res) => {
    const { message } = req.body;
    const { memId, memNick} = req.session;
    console.log(memId, memNick);

    if (message == null || message.trim() === '') { // null 체크 추가
        res.status(400).send('메세지를 입력하세요');
        return;
    }
    
    // 채팅 데이터 집어 넣기
    const sql = "INSERT INTO RealTimeBoard(memId, memNick, content, indate) VALUES(?, ?, ?,  NOW());"
    conn.query(sql, [memId, memNick, message], (error, results) => {
        if (error) throw error;
        console.log("메세지 성공");
        
        // DB에 저장되어 있는 값 받아서 json 형태로 반환
        const sql2 = "SELECT memNick, content, indate FROM RealTimeBoard ORDER BY indate desc LIMIT 100;"
        conn.query(sql2, (error, results) => {
            if (error) throw error;
            const data = results.map(result => ({ 
                memNick: result.memNick,
                content: result.content,
                indate: convertDate(result.indate)
            }));
            res.json(data);
        });
    });
});


// 채팅 시간 반환해주는 함수 
function convertDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1;
    const day = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
    const hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
    const minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
    const seconds = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}


// 채팅 DB에 저장되어 있는 값 json 형태로 반환
app.get('/chat', (req, res) => {
    const sql = "SELECT memNick, content, indate FROM RealTimeBoard ORDER BY indate desc LIMIT 100;"
    conn.query(sql, (error, results) => {
        if (error) throw error;
        // const data = results;
        const data = results.map(result => ({ 
            memNick: result.memNick,
            content: result.content,
            indate: convertDate(new Date(result.indate))
        }));
        res.json(data);
    });
});


// 검색
app.get('/search', function (req, res) { // app.get() 메소드를 사용하여 "/search" 경로로 들어온 GET 요청을 처리합니다.
    const searchKeyword = req.query.search; // req.query.search를 통해 검색어를 가져옵니다.
    const memSex = req.session.memSex; // req.session을 통해 세션에 저장된 회원의 성별(memSex)과 나이(memAge) 정보를 가져옵니다.
    const memAge = req.session.memAge;
    const keywords = ['문재인', '윤석열', '심상정', '홍준표', '안철수', '이재명']; // keywords 배열에는 검색 가능한 키워드가 저장되어 있습니다.

    // 검색어가 keywords 배열에 포함되어 있지 않은 경우, 구글 검색으로 이동하는 스크립트를 전송합니다.
    if (!keywords.includes(searchKeyword)) {
        return;
    } else {
        const updateSql = `UPDATE Search SET frequency = frequency+1, manCnt = manCnt+${memSex === 'M' ? '1' : '0'}, womanCnt = womanCnt+${memSex === 'W' ? '1' : '0'}, tenCnt = tenCnt+${memAge >= 0 && memAge < 20 ? '1' : '0'}, twentyCnt = twentyCnt+${memAge >= 20 && memAge < 30 ? '1' : '0'}, thirtyCnt = thirtyCnt+${memAge >= 30 && memAge < 40 ? '1' : '0'}, fortyCnt = fortyCnt+${memAge >= 40 && memAge < 50 ? '1' : '0'}, fiftyCnt = fiftyCnt+${memAge >= 50 && memAge < 60 ? '1' : '0'}, sixtyCnt = sixtyCnt+${memAge >= 60 ? '1' : '0'} WHERE searchTerms = '${searchKeyword}'`;
        // 값이 있을시 빈도수만 업데이트하는 쿼리문 변수에 저장
        conn.query(updateSql, function (err, rows, fields) {
            if (rows.affectedRows === 0) { // 검색어가 Search테이블에 없으면 새로운 데이터행 추가.

                const insertSql = `INSERT INTO Search(searchTerms, frequency, manCnt, womanCnt, tenCnt, twentyCnt, thirtyCnt, fortyCnt, fiftyCnt, sixtyCnt) 
                VALUES ('${searchKeyword}', 1, ${memSex === 'M' ? '1' : '0'}, ${memSex === 'W' ? '1' : '0'}, ${memAge >= 0 && memAge < 20 ? '1' : '0'}, ${memAge >= 20 && memAge < 30 ? '1' : '0'}, ${memAge >= 30 && memAge < 40 ? '1' : '0'}, ${memAge >= 40 && memAge < 50 ? '1' : '0'}, ${memAge >= 50 && memAge < 60 ? '1' : '0'}, ${memAge >= 60 ? '1' : '0'})`;

                conn.query(insertSql, function (err, rows, fields) {
                    if (err) {
                        console.log(err);
                        res.status(500).send('Internal Server Error');
                    } else { // 검색어 추가후 렌더링
                        res.render('search', { memId: req.session.memId, memNick: req.session.memNick, memSex: req.session.memSex, memAge: req.session.memAge, searchKeyword: searchKeyword });
                    }
                });
            } else { // 검색어가 있을시 업데이트후 렌더링
                const selectSql = `SELECT frequency, manCnt, womanCnt, tenCnt, twentyCnt, thirtyCnt, fortyCnt, fiftyCnt, sixtyCnt FROM Search WHERE searchTerms = '${searchKeyword}'`;
            
                conn.query(selectSql, function (err, rows, fields) {
                    if (err) {
                        console.log(err);
                        res.status(500).send('Internal Server Error');
                        return;
                    }
                    const searchData = rows[0];
                    const Yyy = [searchData.tenCnt, searchData.twentyCnt, searchData.thirtyCnt, searchData.fortyCnt, searchData.fiftyCnt, searchData.sixtyCnt];
                    const Sex = [searchData.manCnt, searchData.womanCnt];
                    const sss = searchData.frequency
            
                    const sumSql = 'SELECT SUM(frequency) AS total_frequency FROM Search;';
                    conn.query(sumSql, function (err, sumRows, fields) {
                        if (err) {
                            console.log(err);
                            res.status(500).send('Internal Server Error');
                            return;
                        }
                        const searchData2 = sumRows[0];
                        const Fre = [searchData.frequency/searchData2.total_frequency, (searchData2.total_frequency-searchData.frequency)/searchData2.total_frequency];
            
                        // sum19와 sum20 쿼리를 수행하여 결과를 가져옴
                        conn.query('select sum(frequency) FROM Search WHERE searchTerms IN ("문재인", "홍준표", "안철수");', function (err, sum19Rows, fields) {
                            if (err) {
                                console.log(err);
                                res.status(500).send('Internal Server Error');
                                return;
                            }
                            const sum19 = sum19Rows[0]['sum(frequency)'];
            
                            conn.query('select sum(frequency) FROM Search WHERE searchTerms IN ("윤석열", "이재명", "심상정");', function (err, sum20Rows, fields) {
                                if (err) {
                                    console.log(err);
                                    res.status(500).send('Internal Server Error');
                                    return;
                                }
                                const sum20 = sum20Rows[0]['sum(frequency)'];
            
                                // 검색 결과와 함께 sum19과 sum20 결과도 함께 렌더링
                                res.render('search', { memId: req.session.memId, memNick: req.session.memNick, memSex: req.session.memSex, memAge: req.session.memAge, searchKeyword: searchKeyword, Yyy: Yyy, Sex: Sex, Fre: Fre, sum19: sum19, sum20: sum20, sss: sss});
                            });
                        });
                    });
                });
            }
        });
    }
});


// 연관 + 키워드 그래프 기능 구현
const csvPath = path.join('C:', 'Users', 'user', 'Desktop', 'Toprospect', 'excel');
const csvFiles = ['문재인_TF-IDF.csv', '안철수_TF-IDF.csv', '홍준표_TF-IDF.csv', '윤석열_TF-IDF.csv', '이재명_TF-IDF.csv', '심상정_TF-IDF.csv'];

app.get('/csvData', (req, res) => {
    const data = csvFiles.map((fileName) => {
        const filePath = path.join(csvPath, fileName); // 파일 경로 생성
        const csvContent = fs.readFileSync(filePath, 'utf8'); // 파일 내용 읽기
        const rows = csvContent.split('\n'); // 쉼표로 구분된 행을 분할
        const words = rows.slice(1, 11).map(row => row.split(',')[0]); // 첫 번째 열(단어)을 가져와 상위 10개 행만 선택
        // TF-IDF 열 데이터 가져오기
        const tfidfValues = rows.slice(1, 8).map(row => {
            const columns = row.split(',');
            return columns.slice(1); // 첫 번째 열(단어)을 제외한 나머지 열(TF-IDF 값) 반환
        });
        return {
            words: words,
            tfidf: tfidfValues
        }; // 단어와 TF-IDF 값 배열을 포함한 객체 반환
    });
    res.send(data); // 열(단어) 배열을 응답으로 보내기
});


// 감정분석 데이터
const SentimentPath = path.join('C:', 'Users', 'user', 'Desktop', 'Toprospect', 'excel');
const SentimentCsvFiles = ['문재인_sentiWord.csv', '안철수_sentiWord.csv', '홍준표_sentiWord.csv', '윤석열_sentiWord.csv', '이재명_sentiWord.csv', '심상정_sentiWord.csv'];
const SentimentScoreFiles = ['문재인DF_감정지수.csv', '안철수DF_감정지수.csv', '홍준표DF_감정지수.csv', '윤석열DF_감정지수.csv', '이재명DF_감정지수.csv', '심상정DF_감정지수.csv'];

// 감정 키워드 데이터 엔드포인트
app.get('/SentimentData', (req, res) => {
    const data = SentimentCsvFiles.map((fileName) => {
        const filePath = path.join(SentimentPath, fileName); // 파일 경로 생성
        const csvContent = fs.readFileSync(filePath, 'utf8'); // 파일 내용 읽기
        const rows = csvContent.split('\n'); // 쉼표로 구분된 행을 분할
        const posWords = rows.slice(1, 11).map(row => row.split(',')[0]); // 첫 번째 열(단어)을 가져와 상위 10개 행만 선택
        const posTfidf = rows.slice(1, 11).map(row => row.split(',')[1]); // 두 번째 열(단어)을 가져와 상위 10개 행만 선택
        const negWords = rows.slice(1, 11).map(row => row.split(',')[2]); // 세 번째 열(단어)을 가져와 상위 10개 행만 선택
        const negTfidf = rows.slice(1, 11).map(row => row.split(',')[3]); // 네 번째 열(단어)을 가져와 상위 10개 행만 선택
        const neuWords = rows.slice(1, 11).map(row => row.split(',')[4]); // 다섯 번째 열(단어)을 가져와 상위 10개 행만 선택
        const neuTfidf = rows.slice(1, 11).map(row => row.split(',')[5]); // 여섯 번째 열(단어)을 가져와 상위 10개 행만 선택
        return {
            posWords: posWords, // 긍정단어
            posTfidf: posTfidf, // 긍정단어 지수
            negWords: negWords, // 부정단어
            negTfidf: negTfidf, // 부정단어 지수
            neuWords: neuWords, // 중립단어
            neuTfidf: neuTfidf, // 중립단어 지수
        };
    });
    res.send(data); // 열(단어) 배열을 응답으로 보내기
});


// 감정 지수 데이터 엔드포인트
app.get('/SentimentScore', (req, res) => {
    const searchKeyword = req.query.search; // 요청 쿼리에서 검색어 추출
    const filteredFiles = SentimentScoreFiles.filter((fileName) => fileName.startsWith(searchKeyword));

    const data = filteredFiles.map((fileName) => {
        const filePath = path.join(SentimentPath, fileName); // 파일 경로 생성
        const csvContent = fs.readFileSync(filePath, 'utf8'); // 파일 내용 읽기
        const rows = csvContent.split('\n').slice(1); // 쉼표로 구분된 행을 분할 후 헤더를 제외한 행만 추출
        
        let sumConfidenceNeg = 0;
        let sumConfidencePos = 0;
        let sumConfidenceNeu = 0;
        
        rows.forEach((row) => {
            const columns = row.split(',');
            if (columns.length >= 4) {
              sumConfidenceNeg += parseFloat(columns[2]); // 부정 감정지수 행의 총합
              sumConfidencePos += parseFloat(columns[3]); // 긍정 감정지수 행의 총합
              sumConfidenceNeu += parseFloat(columns[4]); // 중립 감정지수 행의 총합
            }
          });
        
        return {
            sumConfidencePos: sumConfidencePos, // 총 긍정 감정 지수
            sumConfidenceNeg: sumConfidenceNeg, // 총 부정 감정 지수
            sumConfidenceNeu: sumConfidenceNeu, // 총 중립 감정 지수
        };
    });
    res.send(data); // 열(단어) 배열을 응답으로 보내기
});

app.listen(3377, () => console.log('서버가동'));