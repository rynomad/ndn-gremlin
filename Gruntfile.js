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
    plato: {
      options:{
        jshint: {
          curly: true,
          eqeqeq: true,
          laxcomma: true,
          laxbreak: true
        }
      },
      shadows: {
        files: {
          'plato': ['src/**/*.js', 'src/**/*.js']
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
        files: ["src/*.js", "src/**/*.js"],
        tasks: ["forever:testServ:restart", "browserify:test", "uglify:test", "mochaTest","jshint", "plato" ]
      },
      nodeTest: {
        files: ["test/node/*.js", "test/*.js"],
        tasks: ["forever:testServ:restart", "mochaTest"]
      },
      browserTest: {
        files: ["test/browser/src/*.js", "test/*.js"],
        tasks: ["forever:testServ:restart", "browserify:test", "uglify:test"]
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
    }
  })

  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks("grunt-mocha-test");
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-plato');
  grunt.loadNpmTasks('grunt-forever');

  grunt.registerTask('suite', ['jshint', 'browserify:test', "uglify:test", "mochaTest"])
  grunt.registerTask('build', [ "browserify:build", "uglify:build"])
};
