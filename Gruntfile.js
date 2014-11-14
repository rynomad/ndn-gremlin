module.exports = function(grunt){

  grunt.initConfig({
    uglify: {
      test: {
        files: {
          'test/browser/compiledSuite.js': ['test/browser/tmp/assembled.js']
        }
      },
      build: {
        files: {
          'build/marx.min.js' : ["build/marx.js"]
        }
      }
    },
    browserify: {
      options:{
      },
      test: {
        src: "test/browser/src/suite.js",
        dest: "test/browser/tmp/assembled.js"
      },
      build: {
        src: "index.js",
        dest: "build/ndn-io.js",
        options: {
          bundleOptions: {
            standalone: 'IO'
          }
        }
      }
    },
    jsdoc : {
      dist : {
        src: ['src/**/*.js', "src/*.js"],
        options: {
          destination: 'doc'
        }
      }
    },
    mochaTest: {
      suite: {
        options: {
          reporter: 'spec'
          ,clearRequireCache: true
        },
        src: ["test/node/suite.js"]
      },
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        laxcomma: true,
        laxbreak: true
      },
      All: ["src/*.js", "src/browser/*.js", "src/node/*.js"]
    },
    watch: {
      all: {
        files: ["src/*.js"],
        tasks: [ "forever:testServ:stop","mochaTest","forever:testServ:start","browserify:test","uglify:test" ]
      },
      nodeTest: {
        files: ["src/node/*.js", "test/*.js"],
        tasks: [ "forever:testServ:stop","mochaTest", "forever:testServ:restart"]
      },
      browserTest: {
        files: ["src/browser/*.js", "test/*.js"],
        tasks: [ "browserify:test", "uglify:test", ]
      },
      livereload: {
        options: { livereload: true },
        files: ['test/browser/compiledSuite.js'],
      }
    },
    forever: {
      testServ: {
        options: {
          index: 'test/daemon.js',
          logDir: 'test/logs'
        }
      }
    },
    removelogging : {
      dist:{
        src : 'dist/src/**/*.js',
        options:{
          namespace: ["debug", "debug.debug"],
          methods: ["debug"]

        }
      }
    },
    connect: {
      base: "test/browser/"
    },
    copy:{
      toDist:{
        files:[
          {expand: true, src: ['src/**'], dest: 'dist/'}
        ]
      }
    }
  })

  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks("grunt-mocha-test");
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-forever');
  grunt.loadNpmTasks('grunt-remove-logging');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-connect');

  grunt.registerTask('startDev', ["forever:testServ:start","connect", "watch"])
  grunt.registerTask("dist",  [ "copy:toDist", "removelogging:dist"])
  grunt.registerTask('suite', [ "mochaTest", "jshint"])
  grunt.registerTask('build', [ "browserify:build", "uglify:build"])
};
