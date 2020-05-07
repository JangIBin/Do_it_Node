//Express 기본 모듈 불러오기
var express = require('express')
  , http = require('http')
  , path = require('path');

//Express의 미들웨어 불러오기
var bodyParser = require('body-parser')
  , cookieParser = require('cookie-parser')
  , static = require('serve-static')
  , errorHandler = require('errorhandler');

//오류 핸들러 모듈 사용
var expressErrorHandler = require('express-error-handler');

//Session 미들웨어 불러오기
var expressSession = require('express-session');

//mongoose 모듈 불러오기
var mongoose = require('mongoose');


//익스프레스 객체 생성
var app = express();

//기본 속성 설정
app.set('port', process.env.PORT || 3000);

//bosy-parser를 사용해 application/x-www-form-urlencoded 파싱
app.use(bodyParser.json());

//public 폴더를 static으로 오픈
app.use('/public', static(path.join(__dirname, 'public')));


//세션 설정
app.use(expressSession({
    secret:'my key',
    resave:true,
    saveUninitialized:true
}));

//라우터 객체 참조
var router = express.Router();

//로그인 라우팅 함수 - 데이터베이스의 정보와 비교
router.route('/process/login').post(function(req, res) {
    console.log('/process/login 호출됨');
    
});

//라우터 객체 등록
app.use('/',router);

//===== 404 오류 페이지 처리 =====//
var errorHandler = expressErrorHandler({
    static: {
        '404': './public/404.html'
    }
});

app.use(expressErrorHandler.httpError(404));
app.use(errorHandler);

//===== 서버시작 =====//
http.createServer(app).listen(app.get('port'), function() {
    console.log('서버가 시작되었습니다. 포트 : ' + app.get('port'));
    
    //데이터베이스 연결
    connectDB();
});


//데이터베이스 객체를 위한 변수 선언
var database;

//데이터베이스 스키마 객체를 위한 변수 선언
var UserSchema;

//데이터베이스 모델 객체를 위한 변수 선언
var UserModel;

//데이터베이스 연결
function connectDB() {
    //데이터베이스 연결 정보
    var databaseUrl = 'mongodb://localhost:27017/local';
    
    //데이터베이스 연결
    console.log('데이터베이스 연결을 시도합니다');
    mongoose.Promise = global.Promise;
    mongoose.connect(databaseUrl);
    database = mongoose.connection;
    
    database.on('error', console.error.bind(console, 'mongoose connection error.'));
    database.on('open', function () {
        console.log('데이터베이스에 연결되었습니다. : ' + databaseUrl);
        
        //스키마 정의
        UserSchema = mongoose.Schema({
            id: String,
            name: String,
            password: String
        });
        console.log('UserSchema 정의함.');
        
        //UserModel 모델 정의
        UserModel = mongoose.model( " Users ", UserSchema);
        console.log('UserModel 정의함.');
    });
    
    //연결 끊어졌을 때 5초 후 재연결
    database.on('disconnected', function() {
        console.log('연결이 끊어졌습니다. 5초후 다시 연결합니다.');
        setInterval(connectDB, 5000);
    });
}

//사용자를 인증하는 함수
var auther = function(database, id, password, callback) {
    console.log('auther 호출됨 : ' + id + ' ', + password);
    
    //아이디와 비밀번호를 사용해 검색
    UserModel.find({"id" : id, "password" : password}, function(err, results) {
        if(err) {
            callback(err, null);
            return;
        }
        
        console.log('아이디 [%s], 비밀번호 [%s]로 사용자 검색 결과', id, password);
        console.dir(result);
        if(results.length > 0) {
            console.log('일치하는 사용자 찾음.', id, password);
            callback(null, results);
        } else {
            console.log("일치하는 사용자를 찾지 못함.");
            callback(null, null);
        }
    });
};

//사용자를 등록하는 함수
var addUser = function(database, id, password, name, callback) {
    console.log('auther 호출됨 : ' + id + ' ' + password);
    
    //UserModel의 인스턴스 생성
    var user = new UserModel({"id" : id, "password" : password, "name" : name});
    
    //save()로 저장
    user.save(function(err) {
        if(err) {
            callback(err, null);
            return;
        }
        
        console.log("사용자 데이터 추가됨.");
        callback(null, user);
    });
};
