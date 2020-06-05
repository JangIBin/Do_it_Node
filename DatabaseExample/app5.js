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

//crypto 모듈 불러오기
var crypto = require('crypto');


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
        
        //user 스키마 및 모델 객체 생성
        createUserSchema();
        
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

//user 스키마 및 모델 객체 생성
function createUserSchema() {
    
    //스키마 정의
    UserSchema = mongoose.Schema({
        id: {type : String, required: true, unique: true, 'default' : ' '},
        hashed_password: {type : String, required: true, 'default' : ' '},
        salt : {type : String, required : true},
        name: {type : String, index: 'hashed', 'default' : ' '},
        age: {type: Number, 'default' : -1},
        created_at : {type : Date, index : {unique : false}, 'default' : Date.now},
        updated_at : {type : Date, index : {unique : false}, 'default' : Date.now}
    });
    
    //password를 virtual 메소드를 정의 : MongoDB에 저장되지 않는 편리한 속성임. 특정 속성을 지정하고
    //set, get 메소드를 정의함
    UserSchema
        .virtual('password')
        .set(function(password) {
        this._password = password;
        this.salt = this.makeSalt();
        this.hashed_password = this.encryptPassword(password);
        console.log('virtual password 호출됨 : ' + this.hashed_password);
    })
    .get (function() {return this._password});
    
    //스키마에 모델 인스턴스에서 사용할 수 있는 메소드 추가
    //비밀번호 암호화 메소드
    UserSchema.method('encryptPassword', function(plainText, inSalt) {
        if(inSalt) {
            return crypto.createHmac('sha1', inSalt).update(plainText).digest('hex');
        } else {
            return crypto.createHmac('sha1', this.salt).update(plainText).digest('hex');
        }
    });
    
    // salt 값 만들기 메소드
    UserSchema.method('makeSalt', function() {
        return Math.round((new Date().valueOf() *Math.random())) + '';
    });
    
    //인증 메소드 - 입력된 비밀번호와 비교 (true/false 리턴)
    UserSchema.method('authenticate', function(plainText, inSalt, hashed_password) {
        if(inSalt) {
            console.log('authenticate 호출됨 : %s -> %s : %s', plainText,
                       this.encryptPassword(plainText, inSalt), hashed_password);
            return this.encryptPassword(plainText, inSalt) == hashed_password;
        } else {
            console.log('authenticate 호출됨 : %s -> %s : %s', plainText,
                       this.encryptPassword(plainText, inSalt), hashed_password);
            return this.encryptPassword(plainText, inSalt) == hashed_password;
        }
    });
    
    //필수 속성에 대한 유효성 확인(길이 값 체크)
    UserSchema.path('id').validate(function(id) {
        return id.length;
    }, 'id 칼럼의 값이 없습니다.');
    
    UserSchema.path('name').validate(function(name) {
        return name.length;
    }, 'name 칼럼의 값이 없습니다.');

    //스키마 static 메소드 추가
    UserSchema.static('findById', function(id, callback) {
        return this.find({id : id}, callback);
    });

    UserSchema.static('findAll', function(callback) {
        return this.find({}, callback);
    });

    console.log('UserSchema 정의함.');

    //UserModel 모델 정의
    UserModel = mongoose.model("users2", UserSchema);
    console.log('UserModel 정의함.');
    
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
    console.log('auther 호출됨');
    
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
}

//사용자를 인증하는 함수 : 아이디로 먼저 찾고 비밀번호를 그다음에 비교
var authUser = function(database, id, password, callback) {
    console.log('authUser 호출됨.');
    
    //1. 아이디를 사용해 검색
    UserModel.findById(id, function(err, results) {
        if(err) {
            callback(err, null);
            return;
        }
    
        console.log('아이디 [%s]로 사용자 검색 결과', id);
        console.dir(results);
    
        if(results.length > 0) {
            console.log('아이디와 일치하는 사용자 찾음.');
        
            //2. 비밀번호 확인 : 모델 인스턴스를 객체를 만들고 authenticate() 메소드 호출
            var user = new UserModel({id : id});
            var authenticated = user.authenticate(password, results[0]._doc.salt,
                                                 results[0]._doc.hashed_password);
            
            if(authenticated) {
                console.log('비밀번호 일치함');
                callback(null, results);
            } else {
                console.log('비밀번호 일치하지 않음');
                callback(null, null);
            }
        } else {
            console.log("아이디와 일치하는 사용자를 찾지 못함.");
            callback(null, null);
        }
    });
}

//사용자 리스트 함수
router.route('/process/listuser').post(function(req, res) {
    console.lof('/process/listuser 호출됨.');
    
    //데이터베이스 객체가 초기화된 경우, 모델 객체의 findAll 메소드 호출
    if (database) {
        //1. 모든 사용자 검색
        UserModel,findAll(function(err, results) {
            //오류가 발생했을 때 클라이언트로 오류 전송
            if (err) {
                console.error('사용자 리스트 조회 중 오류 발생 : ' + err.stack);
                
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
                res.write("<h2>사용자 리스트 조회 중 오류 발생</h2>");
                res.write('<p>' + err.stack + '</p>');
                res.end();
                
                return;
            }
            
            if(results) { //결과 객체 있으면 리스트 전송
                console.dir(results);
                
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 리스트</h2>');
                res.write('<div><ul>');
                
                for (var i = 0; i < results.length; i++) {
                    var curId = resulta[i]._doc.id;
                    var curName = results[i]._doc.name;
                    res.write('     <li>#' + i + ' : ' + curId + ', ' + curName + '</li>');
                }
                
                res.write('</ul></div>');
                res.end();
            } else { //결과 객체가 없으면 실패 응답 전송
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 리스트 조회 실패</h2>');
                res.end();
            }
        });
    } else { //데이터베이스 객체가 초기화되지 않았을 때 실패 응답 전송
        res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
        res.write('<h2>데이터베이스 연결 실패</h2>');
        res.end();
    }
});


