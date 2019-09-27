((function ( $ ) {
  "use strict";

  $.widget('aerolab.blockrain', {
    options: {
      autoplay: false, // Let a bot play the game
      autoplayRestart: true, // Restart the game automatically once a bot loses
      showFieldOnStart: false, // Show a bunch of random blocks on the start screen (it looks nice)
      theme: 'brenger', // The theme name or a theme object
      blockWidth: 8, // Amount of blocks in a row
      blockHeight: 10, // Amount of rows in the board
      autoBlockWidth: false, // The blockWidth is dinamically calculated based on the autoBlockSize. Disabled blockWidth. Useful for responsive backgrounds
      autoBlockSize: 24, // The max size of a block for autowidth mode
      difficulty: 'normal', // Difficulty (normal|nice|evil).
      speed: 20, // The speed of the game. The higher, the faster the pieces go.
      asdwKeys: false, // Enable ASDW keys
      timeLimit: null,

      // Copy
      startTextStatic: 'Press any button to start',
      startText: 'Breng it on!',
      playButtonText: 'Play',
      gameOverText: 'Game Over',
      restartButtonText: 'Play Again',
      scoreText: 'Score',

      // Basic Callbacks
      onStart: function(){},
      onRestart: function(){},
      onGameOver: function(score){},

      // When a block is placed
      onPlaced: function(){},
      // When a line is made. Returns the number of lines, score assigned and total score
      onLine: function(lines, scoreIncrement, score){}
    },

    ___attachGameInitHandler() {
      const gameStartHandler = (event) => {
        switch(event.keyCode) {
          case 37:
          case 38:
          case 39:
          case 40:
            this.start()
            $(document).off(`keyup`, gameStartHandler)
          default: break
        }
      }
      $(document).on(`keyup`, gameStartHandler)
    },
    ___updateTimer(totalAmountOfSeconds) {
      const minutes = Math.floor(totalAmountOfSeconds / 60)
      const seconds = totalAmountOfSeconds % 60

      this.___$timer.text(`${minutes}:${seconds < 10 ? '0' + seconds : seconds}`)
    },
    ___updateScoreboard() {
      const maxRecords = 10
      const minBestScore = this.___bestScores.length > 0
        ? Math.min(...this.___bestScores)
        : 0
      const currentScore = this.score()

      if (currentScore > minBestScore) {
        if (this.___bestScores === maxRecords) {
          this.___bestScores = this.___bestScores
            .filter((score) => score !== minBestScore)
        }
        this.___bestScores.push(currentScore)
      }

      this.___$scoreboard.find(`ul`).remove()
      const scoreboardList = $(`<ul></ul>`)

      this.___bestScores.sort((a, b) => b - a).forEach((score) => {
        scoreboardList.append($(`<li>${score}</li>`))
      })
      this.___$scoreboard.append(scoreboardList)
    },
    ___updateScoreCounter(score) {
      this.___$scoreCounter.text(score)
    },
    ___updateBlownLinesCounter(count) {
      $(`.blown_lines__counter`).text(count)
    },
    ___updateNextShape({ blockType, orientation: turns }) {
      const blockImages = window.BlockrainThemes.brenger.complexBlocks
      const imageSrc = blockImages[blockType]

      this.___$nextShapeImage
        .prop(`src`, imageSrc)
        // 1 turn = 90*
        .css({ transform: `translate(${90 * turns}deg)` })
    },
    ___extractBlownChunks(rows) {
      const rowIdxMin = Math.min(...rows)
      const rowIdxMax = Math.max(...rows)
      const rowsRange = rowIdxMax - rowIdxMin + 1

      const $canvasBlownLine = this._$canvas.clone()
      const canvasBlownLine = $canvasBlownLine[0]
      const canvasBlownLineCtx = canvasBlownLine.getContext(`2d`)
      const rowHeight = canvasBlownLine.height / this._BLOCK_HEIGHT
      const actualRowHeight = this._canvas.clientHeight / this._BLOCK_HEIGHT
      const rowWidth = canvasBlownLine.width
      const actualRowWidth = this._canvas.clientWidth
      const topmostRowY = rowHeight * rowIdxMin

      canvasBlownLine.width = rowWidth
      canvasBlownLine.height = rowHeight

      const $blownLinesWrapper = $(`<div />`)
        .css({
          display: `flex`,
          'flex-direction': `column`,
          position: `absolute`,
          top: actualRowHeight * rowIdxMin,
          width: actualRowWidth,
          height: actualRowHeight * rowsRange,
        })

      let generatedRules = []
      let $slowestElement = null
      let longestAnimationDuration = 0

      // Clip necessary amount of blown lines.
      for (let innerIdx = 0; innerIdx < rowsRange; ++innerIdx) {
        const $blownChunksWrapper = $(`<section />`)
          .css({
            display: `flex`,
            height: `${actualRowHeight}px`,
          })

        const offsetY = rowHeight * innerIdx

        canvasBlownLineCtx.drawImage(
          this._canvas,
          0,
          topmostRowY + offsetY,
          rowWidth,
          rowHeight,
          0,
          0,
          rowWidth,
          rowHeight,
        )

        const extractIndividualChunks = () => {
          const $canvasBlownChunk = $canvasBlownLine.clone()
          const canvasBlownChunk = $canvasBlownChunk[0]
          const canvasBlownChunkCtx = canvasBlownChunk.getContext(`2d`)
          const chunkWidth = canvasBlownLine.width / this._BLOCK_WIDTH
          const actualChunkWidth = actualRowWidth / this._BLOCK_WIDTH
          canvasBlownChunk.width = chunkWidth

          const towardsSaucer = -(this.___vanHeight / 2) - (actualRowHeight * (rows[innerIdx] + 1))
          const towardsVan = (
            (this._BLOCK_HEIGHT - rows[innerIdx]) * actualRowHeight -
            this.___vanHeight * 0.75
          )
          const targetTranslateY = this.___vansSwapping
            ? towardsSaucer
            : towardsVan

          // Chop up line into separate chunks to animate them invidivially.
          for (let chunkIdx = 0; chunkIdx < this._BLOCK_WIDTH; chunkIdx++) {
            canvasBlownChunkCtx.drawImage(
              canvasBlownLine,
              chunkWidth * chunkIdx,
              0,
              chunkWidth,
              rowHeight,
              0,
              0,
              chunkWidth,
              rowHeight,
            )

            const yAxisRuleName = `
              blown_y_row_${innerIdx}_chunk_${chunkIdx}_${Date.now()}
            `
            const throwHeight = this.___vanHeight * 1.6 + 20 * Math.ceil(Math.random() * 10)
            const peak = 55
            const animationDuration = 1 + throwHeight / 5000

            const liftAnimation = `
              @keyframes ${yAxisRuleName} {
                100% {
                  transform: translateY(${targetTranslateY}px);
                }
              }
            `
            const projectileAnimation = `
              @keyframes ${yAxisRuleName} {
                ${peak}% {
                  animation-timing-function: ease-in;
                  transform: translateY(-${throwHeight}px);
                }
                100% {
                  transform: translateY(${targetTranslateY}px);
                }
              }
            `

            this.___stylesheet.insertRule(
              this.___vansSwapping ? liftAnimation : projectileAnimation,
              0
            )

            const vanElement = $(`.van`)[0]
            // This essential represents middle of the board.
            const middleOfSaucer = (
              (this._BLOCK_WIDTH / 2 - chunkIdx - 0.5) *
              actualChunkWidth
            )
            const middleOfVan = (
              actualRowWidth +
              vanElement.clientWidth / 3 +
              vanElement.offsetLeft -
              actualChunkWidth * chunkIdx
            )
            const targetTranslateX = this.___vansSwapping
              ? middleOfSaucer
              : middleOfVan

            const xAxisRuleName = `
              blown_x_row_${innerIdx}_chunk_${chunkIdx}_${Date.now()}
            `
            this.___stylesheet.insertRule(
              `@keyframes ${xAxisRuleName} {
                100% {
                  transform: translateX(${targetTranslateX}px);
                }
              }`,
              0
            )

            generatedRules.push(yAxisRuleName, xAxisRuleName)

            const $blownChunkWrapper = $(`<section />`)
              .css({
                'z-index': 30,
                width: actualChunkWidth,
                animation: `${xAxisRuleName} ${animationDuration}s ease-out forwards`,
              })

            const $chunkImg = $(`<img />`)
              .attr(`src`, canvasBlownChunk.toDataURL())
              .css({
                height: `${actualRowHeight}px`,
                animation: `${yAxisRuleName} ${animationDuration}s ease-out forwards`,
              })

            if (animationDuration > longestAnimationDuration) {
              longestAnimationDuration = animationDuration
              $slowestElement = $blownChunkWrapper
            }

            $chunkImg.appendTo($blownChunkWrapper)
            $blownChunkWrapper.appendTo($blownChunksWrapper)
          }
        }

        extractIndividualChunks()

        $blownChunksWrapper.appendTo($blownLinesWrapper)
      }

      return {
        $blownLinesWrapper,
        $slowestElement,
        generatedRules,
        longestAnimationDuration,
      }
    },
    ___animateBlownChunks({
      onAnimationStart = () => {},
      onAnimationEnd = () => {},
      $blownLinesWrapper,
      $slowestElement,
      generatedRules,
    }) {
      $slowestElement.on(`animationend`, () => {
        this.___deleteStyleRules(generatedRules)
        $blownLinesWrapper.remove()

        onAnimationEnd()
      })

      $blownLinesWrapper.appendTo(`.blockrain-game-holder`)

      onAnimationStart()
    },
    ___vansSwappingScene() {
      this.___vansSwapping = true

      const $parkedVan = $(`.van--parked`)

      const parkedOnTransitionEnd = () => {
        $parkedVan
          .addClass(`van--hidden`)
          .removeClass(`van--driving-away`)

        $parkedVan.off(`transitionend`, parkedOnTransitionEnd)
      }

      $parkedVan.on(`transitionend`, parkedOnTransitionEnd)

      $parkedVan
        .addClass(`van--driving-away`)
        .removeClass(`van--parked`)

      const $hiddenVan = $(`.van--hidden`)

      const hiddenOnTransitionEnd = () => {
        this.___vansSwapping = false

        $hiddenVan
          .addClass(`van--parked`)
          .removeClass(`van--driving-in`)

        $hiddenVan.off(`transitionend`, hiddenOnTransitionEnd)
      }

      $hiddenVan.on(`transitionend`, hiddenOnTransitionEnd)

      $hiddenVan
        .addClass(`van--driving-in`)
        .removeClass(`van--hidden`)
    },
    ___saucerScene(longestAnimationDuration) {
      const saucerAnimationName = `saucer_animation_${Date.now()}`

      this.___stylesheet.insertRule(`
        @keyframes ${saucerAnimationName} {
          15%, 30% {
            transform: translateY(-${this.___vanHeight * 1.1}px);
          }
          30% {
            animation-timing-function: ease-in;
          }
          100% {
            transform: translateY(-5000px);
          }
        }`,
        this.___stylesheet.cssRules.length
      )

      this.___$saucer.css({
        animation: `${saucerAnimationName} ${longestAnimationDuration * 4}s ease-out`,
      })

      const saucerOnAnimationEnd = () => {
        this.___deleteStyleRule(saucerAnimationName)

        this.___$saucer
          .css({ animation: `unset` })
          .off(`animationend`, saucerOnAnimationEnd)
      }

      this.___$saucer.on(`animationend`, saucerOnAnimationEnd)
    },
    ___setStyleSheetForManipulation() {
      const [ stylesheet ] = Array.from(document.styleSheets)
        .filter(({ title }) => title === `main`)

      this.___stylesheet = stylesheet
    },
    ___deleteStyleRules(rules) {
      const cssRules = Array.from(this.___stylesheet.cssRules)

      rules
        .map((name) => name.trim())
        .forEach((name) => this.___stylesheet
          .deleteRule(cssRules.findIndex((rule) => name === rule.name))
        )
    },
    ___deleteStyleRule(name) {
      const cssRules = Array.from(this.___stylesheet.cssRules)

      this.___stylesheet
        .deleteRule(cssRules.findIndex((rule) => name === rule.name))
    },

    /**
     * Start/Restart Game
     */
    start() {
      this._doStart();
      this.options.onStart.call(this.element);

      if (this.options.timeLimit) {
        this.___updateTimer(this.options.timeLimit)

        this.___timeLeft = this.options.timeLimit

        this.___timerId = setInterval(() => {
          if (this.___timeLeft === 0) {
            clearInterval(timerId)
            return this.gameover()
          }
          else {
            this.___timeLeft -= 1
            this.___updateTimer(this.___timeLeft)
          }
        }, 1000)
      }
    },

    restart: function() {
      this._doStart();
      this.options.onRestart.call(this.element);
    },

    gameover: function() {
      this.showGameOverMessage();
      this._board.gameover = true;

      this.___updateScoreboard()

      clearInterval(this.___timerId)

      this.options.onGameOver.call(this.element, this._filled.score);
    },

    _doStart: function() {
      this._filled.clearAll();
      this._filled._resetScore();
      this._board.cur = this._board.nextShape();
      this._board.started = true;
      this._board.gameover = false;
      this._board.dropDelay = 5;
      this._board.render(true);
      this._board.animate();

      this.___$startMessageStatic.fadeOut(150);
      this.___$gameover.fadeOut(150);

      this.___$startMessage.fadeIn(250, () => {
        setTimeout(() => this.___$startMessage.fadeOut(250), 500)
      });
    },

    pause: function() {
      this._board.paused = true;
    },

    resume: function() {
      this._board.paused = false;
    },

    autoplay: function(enable) {
      if( typeof enable !== 'boolean' ){ enable = true; }

      // On autoplay, start the game right away
      this.options.autoplay = enable;
      if( enable && ! this._board.started ) {
        this._doStart();
      }
      this._setupControls( ! enable );
      this._setupTouchControls( ! enable );
    },

    controls: function(enable) {
      if( typeof enable !== 'boolean' ){ enable = true; }
      this._setupControls(enable);
    },

    touchControls: function(enable) {
      if( typeof enable !== 'boolean' ){ enable = true; }
      this._setupTouchControls(enable);
    },

    score: function(newScore) {
      if( typeof newScore !== 'undefined' && parseInt(newScore) >= 0 ) {
        this._filled.score = parseInt(newScore);
        this.___updateScoreCounter(this._filled_score)
      }
      return this._filled.score;
    },

    freesquares: function() {
      return this._filled.getFreeSpaces();
    },

    showStartMessage: function() {
      this.___$startMessageStatic.show();
    },

    showGameOverMessage: function() {
      this.___$gameover.show();
      this.___attachGameInitHandler()
    },

    /**
     * Update the sizes of the renderer (this makes the game responsive)
     */
    updateSizes: function() {
      this._PIXEL_WIDTH = this.element.innerWidth();
      this._PIXEL_HEIGHT = this.element.innerHeight();

      this._BLOCK_WIDTH = this.options.blockWidth;
      this._BLOCK_HEIGHT = this.options.blockHeight;

      this._block_size = Math.floor(this._PIXEL_WIDTH / this._BLOCK_WIDTH);
      this._border_width = 2;

      // Recalculate the pixel width and height so the canvas always has the best possible size
      this._PIXEL_WIDTH = this._block_size * this._BLOCK_WIDTH;
      this._PIXEL_HEIGHT = this._block_size * this._BLOCK_HEIGHT;

      this._$canvas
        .attr('width', this._PIXEL_WIDTH)
        .attr('height', this._PIXEL_HEIGHT)
    },

    theme: function(newTheme){

      if( typeof newTheme === 'undefined' ) {
        return this.options.theme || this._theme;
      }

      // Setup the theme properly
      if( typeof newTheme === 'string' ) {
        this.options.theme = newTheme;
        this._theme = $.extend(true, {}, BlockrainThemes[newTheme]);
      }
      else {
        this.options.theme = null;
        this._theme = newTheme;
      }

      if( typeof this._theme === 'undefined' || this._theme === null ) {
        this._theme = $.extend(true, {}, BlockrainThemes['retro']);
        this.options.theme = 'retro';
      }

      if( isNaN(parseInt(this._theme.strokeWidth)) || typeof parseInt(this._theme.strokeWidth) !== 'number' ) {
        this._theme.strokeWidth = 2;
      }

      // Load the image assets
      this._preloadThemeAssets();

      if( this._board !== null ) {
        if( typeof this._theme.background === 'string' ) {
          this._$canvas.css('background-color', this._theme.background);
        }
        this._board.render();
      }
    },

    ___bestScores: [],
    ___timeLeft: 0,
    ___blownLinesCount: 0,
    ___$startMessageStatic: null,
    ___$gameover: null,
    ___$scoreCounter: null,
    ___vansSwapping: false,
    ___stylesheet: null,

    // UI Elements
    _$game: null,
    _$canvas: null,
    _$gameholder: null,
    _$score: null,

    // Canvas
    _canvas: null,
    _ctx: null,

    // Initialization
    _create: function() {
      var game = this;

      this.___setStyleSheetForManipulation()

      this.theme(this.options.theme);

      this._createHolder();
      this._createUI();

      this._refreshBlockSizes();

      this.updateSizes();

      $(window).resize(function(){
        //game.updateSizes();
      });

      this._SetupShapeFactory();
      this._SetupFilled();
      this._SetupInfo();
      this._SetupBoard();

      this._info.init();
      this._board.init();

      var renderLoop = function(){
        requestAnimationFrame(renderLoop);
        game._board.render();
      };
      renderLoop();

      if( this.options.autoplay ) {
        this.autoplay(true);
        this._setupTouchControls(false);
      } else {
        this._setupControls(true);
        this._setupTouchControls(false);
      }

    },

    _checkCollisions: function(x, y, blocks, checkDownOnly) {
      // x & y should be aspirational values
      var i = 0, len = blocks.length, a, b;
      for (; i<len; i += 2) {
        a = x + blocks[i];
        b = y + blocks[i+1];

        if (b >= this._BLOCK_HEIGHT || this._filled.check(a, b)) {
          return true;
        } else if (!checkDownOnly && a < 0 || a >= this._BLOCK_WIDTH) {
          return true;
        }
      }
      return false;
    },

    _board: null,
    _info: null,
    _filled: null,

    /**
     * Draws the background
     */
    _drawBackground: function() {

      if( typeof this._theme.background !== 'string' ) {
        return;
      }

      if( this._theme.backgroundGrid instanceof Image ) {

        // Not loaded
        if( this._theme.backgroundGrid.width === 0 || this._theme.backgroundGrid.height === 0 ){ return; }

        this._ctx.globalAlpha = 1.0;

        for( var x=0; x<this._BLOCK_WIDTH; x++ ) {
          for( var y=0; y<this._BLOCK_HEIGHT; y++ ) {
            var cx = x * this._block_size;
            var cy = y * this._block_size;

            this._ctx.drawImage(  this._theme.backgroundGrid,
                                  0, 0, this._theme.backgroundGrid.width, this._theme.backgroundGrid.height,
                                  cx, cy, this._block_size, this._block_size);
          }
        }

      }
      else if( typeof this._theme.backgroundGrid === 'string' ) {

        var borderWidth = this._theme.strokeWidth;
        var borderDistance = Math.round(this._block_size*0.23);
        var squareDistance = Math.round(this._block_size*0.30);

        this._ctx.globalAlpha = 1.0;
        this._ctx.fillStyle = this._theme.backgroundGrid;

        for( var x=0; x<this._BLOCK_WIDTH; x++ ) {
          for( var y=0; y<this._BLOCK_HEIGHT; y++ ) {
            var cx = x * this._block_size;
            var cy = y * this._block_size;

            this._ctx.fillRect(cx+borderWidth, cy+borderWidth, this._block_size-borderWidth*2, this._block_size-borderWidth*2);
          }
        }

      }

      this._ctx.globalAlpha = 1.0;
    },

    /**
     * Shapes
     */
    _shapeFactory: null,

    _shapes: {
      /**
       * The shapes have a reference point (the dot) and always rotate left.
       * Keep in mind that the blocks should keep in the same relative position when rotating,
       * to allow for custom per-block themes.
       */
      /*
       *   X
       *   O  XOXX
       *   X
       *   X
       *   .   .
       */
      line: [
          [ 0, -1,   0, -2,   0, -3,   0, -4],
          [ 2, -2,   1, -2,   0, -2,  -1, -2],
          [ 0, -4,   0, -3,   0, -2,   0, -1],
          [-1, -2,   0, -2,   1, -2,   2, -2]
      ],
      /*
       *  XX
       *  XX
       */
      square: [
        [0,  0,   1,  0,   0, -1,   1, -1],
        [1,  0,   1, -1,   0,  0,   0, -1],
        [1, -1,   0, -1,   1,  0,   0,  0],
        [0, -1,   0,  0,   1, -1,   1,  0]
      ],
      /*
       *    X   X       X
       *   XOX XO  XOX  OX
       *   .   .X  .X  .X
       */
      arrow: [
        [0, -1,   1, -1,   2, -1,   1, -2],
        [1,  0,   1, -1,   1, -2,   0, -1],
        [2, -1,   1, -1,   0, -1,   1,  0],
        [1, -2,   1, -1,   1,  0,   2, -1]
      ],
      /*
       *    X    X XX
       *    O  XOX  O XOX
       *   .XX .   .X X
       */
      rightHook: [
        [2,  0,   1,  0,   1, -1,   1, -2],
        [2, -2,   2, -1,   1, -1,   0, -1],
        [0, -2,   1, -2,   1, -1,   1,  0],
        [0,  0,   0, -1,   1, -1,   2, -1]
      ],
      /*
       *    X      XX X
       *    O XOX  O  XOX
       *   XX . X .X  .
       */
      leftHook: [
        [0,  0,   1,  0,   1, -1,   1, -2],
        [2,  0,   2, -1,   1, -1,   0, -1],
        [2, -2,   1, -2,   1, -1,   1,  0],
        [0, -2,   0, -1,   1, -1,   2, -1]
      ],
      /*
       *    X  XX
       *   XO   OX
       *   X   .
       */
      leftZag: [
        [0,  0,   0, -1,   1, -1,   1, -2],
        [2, -1,   1, -1,   1, -2,   0, -2],
        [1, -2,   1, -1,   0, -1,   0,  0],
        [0, -2,   1, -2,   1, -1,   2, -1]
      ],
      /*
       *   X
       *   XO   OX
       *   .X  XX
       */
      rightZag: [
        [1,  0,   1, -1,   0, -1,   0, -2],
        [2, -1,   1, -1,   1,  0,   0,  0],
        [0, -2,   0, -1,   1, -1,   1,  0],
        [0,  0,   1,  0,   1, -1,   2, -1]
      ]
    },

    _SetupShapeFactory: function(){
      var game = this;
      if( this._shapeFactory !== null ){ return; }


      function Shape(game, orientations, symmetrical, blockType) {

        $.extend(this, {
          x: 0,
          y: 0,
          symmetrical: symmetrical,
          init: function() {
            $.extend(this, {
              orientation: 0,
              x: Math.floor(game._BLOCK_WIDTH / 2) - 1,
              y: -1
            });
            return this;
          },

          blockType: blockType,
          blockVariation: null,
          blocksLen: orientations[0].length,
          orientations: orientations,
          orientation: 0, // 4 possible

          rotate: function(direction) {
            var orientation =
              (this.orientation + (direction === "left" ? 1 : -1) + 4) % 4;

            if (!game._checkCollisions(
                this.x,
                this.y,
                this.getBlocks(orientation)
              )) {
              this.orientation = orientation;
              game._board.renderChanged = true;
            } else {
              var ogOrientation = this.orientation;
              var ogX = this.x;
              var ogY = this.y;

              this.orientation = orientation;

              while (this.x >= game._BLOCK_WIDTH - 2) {
                this.x--;
              }
              while (this.x < 0) {
                this.x++;
              }

              if (this.blockType === "line" && this.x === 0) this.x++;

              if ( game._checkCollisions(
                  this.x,
                  this.y,
                  this.getBlocks(orientation)
                )
              ) {
                this.y--;
                if (
                    game._checkCollisions(
                      this.x,
                      this.y,
                      this.getBlocks(orientation)
                    )
                ) {
                    this.x = ogX;
                    this.y = ogY;
                    this.orientation = ogOrientation;
                }
              }
              game._board.renderChanged = true;
            }
          },

          moveRight: function() {
            if (!game._checkCollisions(this.x + 1, this.y, this.getBlocks())) {
              this.x++;
              game._board.renderChanged = true;
            }
          },
          moveLeft: function() {
            if (!game._checkCollisions(this.x - 1, this.y, this.getBlocks())) {
              this.x--;
              game._board.renderChanged = true;
            }
          },
          drop: function() {
            if (!game._checkCollisions(this.x, this.y + 1, this.getBlocks())) {
              this.y++;
              // Reset the drop count, as we dropped the block sooner
              game._board.dropCount = -1;
              game._board.animate();
              game._board.renderChanged = true;
            }
          },

          getBlocks: function(orientation) { // optional param
            return this.orientations[orientation !== undefined ? orientation : this.orientation];
          },
          draw: function(_x, _y, _orientation) {
            var blocks = this.getBlocks(_orientation),
                x = _x === undefined ? this.x : _x,
                y = _y === undefined ? this.y : _y,
                i = 0,
                index = 0;

            for (; i<this.blocksLen; i += 2) {
              game._board.drawBlock(x + blocks[i], y + blocks[i+1], this.blockType, this.blockVariation, index, this.orientation, true);
              index++;
            }
          },
          getBounds: function(_blocks) { // _blocks can be an array of blocks, an orientation index, or undefined
            var blocks = $.isArray(_blocks) ? _blocks : this.getBlocks(_blocks),
                i=0, len=blocks.length, minx=999, maxx=-999, miny=999, maxy=-999;
            for (; i<len; i+=2) {
              if (blocks[i] < minx) { minx = blocks[i]; }
              if (blocks[i] > maxx) { maxx = blocks[i]; }
              if (blocks[i+1] < miny) { miny = blocks[i+1]; }
              if (blocks[i+1] > maxy) { maxy = blocks[i+1]; }
            }
            return {
              left: minx,
              right: maxx,
              top: miny,
              bottom: maxy,
              width: maxx - minx,
              height: maxy - miny
            };
          }
        });

        return this.init();
      };

      this._shapeFactory = {
        line: function() {
          return new Shape(game, game._shapes.line, false, 'line');
        },
        square: function() {
          return new Shape(game, game._shapes.square, false, 'square');
        },
        arrow: function() {
          return new Shape(game, game._shapes.arrow, false, 'arrow');
        },
        leftHook: function() {
          return new Shape(game, game._shapes.leftHook, false, 'leftHook');
        },
        rightHook: function() {
          return new Shape(game, game._shapes.rightHook, false, 'rightHook');
        },
        leftZag: function() {
          return new Shape(game, game._shapes.leftZag, false, 'leftZag');
        },
        rightZag: function() {
          return new Shape(game, game._shapes.rightZag, false, 'rightZag');
        }
      };
    },

    _SetupFilled: function() {
      var game = this;

      if (this._filled !== null) return

      this._filled = {
        data: new Array(game._BLOCK_WIDTH * game._BLOCK_HEIGHT),
        score: 0,
        toClear: {},
        check: function(x, y) {
          return this.data[this.asIndex(x, y)];
        },
        add: function(x, y, blockType, blockVariation, blockIndex, blockOrientation) {
          if (x >= 0 && x < game._BLOCK_WIDTH && y >= 0 && y < game._BLOCK_HEIGHT) {
            this.data[this.asIndex(x, y)] = {
              blockType: blockType,
              blockVariation: blockVariation,
              blockIndex: blockIndex,
              blockOrientation: blockOrientation
            };
          }
        },
        getFreeSpaces: function() {
          var count = 0;
          for( var i=0; i<this.data.length; i++ ) {
            count += (this.data[i] ? 1 : 0);
          }
        },
        asIndex: function(x, y) {
          return x + y*game._BLOCK_WIDTH;
        },
        asX: function(index) {
          return index % game._BLOCK_WIDTH;
        },
        asY: function(index) {
          return Math.floor(index / game._BLOCK_WIDTH);
        },
        clearAll: function() {
          delete this.data;
          this.data = new Array(game._BLOCK_WIDTH * game._BLOCK_HEIGHT);
        },
        _popRow: function(row_to_pop) {
          for (var i=game._BLOCK_WIDTH*(row_to_pop+1) - 1; i>=0; i--) {
            this.data[i] = (i >= game._BLOCK_WIDTH ? this.data[i-game._BLOCK_WIDTH] : undefined);
          }
        },
        checkForClears: function() {
          var startLines = game._board.lines;
          var rows = [], i, len, count, mod;

          for (i=0, len=this.data.length; i<len; i++) {
            mod = this.asX(i);
            if (mod == 0) count = 0;
            if (this.data[i] && typeof this.data[i] !== 'undefined' && typeof this.data[i].blockType === 'string') {
              count += 1;
            }
            if (mod == game._BLOCK_WIDTH - 1 && count == game._BLOCK_WIDTH) {
              rows.push(this.asY(i));
            }
          }

          if (rows.length > 0) {
            const { longestAnimationDuration, ...other } = game.___extractBlownChunks(rows)

            game.___animateBlownChunks({
              ...(
                game.___vansSwapping
                  ? {
                    onAnimationStart: game.___saucerScene.bind(game, longestAnimationDuration)
                  }
                  : {
                    onAnimationEnd: game.___vansSwappingScene.bind(game)
                  }
              ),
              ...other
            })
          }

          for (i=0, len=rows.length; i<len; i++) {
            this._popRow(rows[i]);
            game._board.lines++;
            if( game._board.lines % 10 == 0 && game._board.dropDelay > 1 ) {
              game._board.dropDelay *= 0.9;
            }
          }

          var clearedLines = game._board.lines - startLines;
          this._updateScore(clearedLines);
        },
        _updateScore: function(numLines) {
          if( numLines <= 0 ) { return; }
          var scores = [0,400,1000,3000,12000];
          if( numLines >= scores.length ){ numLines = scores.length-1 }

          this.score += scores[numLines];
          game.___updateScoreCounter(this.score)

          game.___blownLinesCount += numLines
          game.___updateBlownLinesCounter(game.___blownLinesCount)

          game.options.onLine.call(game.element, numLines, scores[numLines], this.score);
        },
        _resetScore: function() {
          this.score = 0;
          game.___updateScoreCounter(this.score)

          game.___blownLinesCount = 0
          game.___updateBlownLinesCounter(game.___blownLinesCount)
        },
        draw: function() {
          for (var i=0, len=this.data.length, row, color; i<len; i++) {
            if (this.data[i] !== undefined) {
              row = this.asY(i);
              var block = this.data[i];
              game._board.drawBlock(this.asX(i), row, block.blockType, block.blockVariation, block.blockIndex, block.blockOrientation);
            }
          }
        }
      };
    },

    _SetupInfo: function() {

      var game = this;

      this._info = {
        mode: game.options.difficulty,
        modes: [
          'normal',
          'nice',
          'evil'
        ],
        modesY: 170,
        autopilotY: null,

        init: function() {
        this.mode = game.options.difficulty;
      },
        setMode: function(mode) {
          this.mode = mode;
          game._board.nextShape(true);
        }
      };

    },

    _SetupBoard: function() {

      var game = this;
      var info = this._info;

      this._board = {
        // This sets the tick rate for the game
        animateDelay: 1000 / game.options.speed,

        animateTimeoutId: null,
        cur: null,

        lines: 0,

        // DropCount increments on each animation frame. After n frames, the piece drops 1 square
        // By making dropdelay lower (down to 0), the pieces move faster, up to once per tick (animateDelay).
        dropCount: 0,
        dropDelay: 5, //5,

        holding: {left: null, right: null, drop: null},
        holdingThreshold: 200, // How long do you have to hold a key to make commands repeat (in ms)

        started: false,
        gameover: false,

        renderChanged: true,

        init: function() {
          this.cur = this.nextShape();

          if( game.options.showFieldOnStart ) {
            game._drawBackground();
            game._board.createRandomBoard();
            game._board.render();
          }

          this.showStartMessage();
        },

        showStartMessage: function() {
          game.___attachGameInitHandler()
          game.___$startMessageStatic.show();
        },

        showGameOverMessage: function() {
          game.___$gameover.show();
        },

        nextShape: function(_set_next_only) {
          var next = this.next,
            func, shape, result;

          if (info.mode == 'nice' || info.mode == 'evil') {
            func = game._niceShapes;
          }
          else {
            func = game._randomShapes();
          }

          if( game.options.no_preview ) {
            this.next = null;
            if (_set_next_only) return null;
            shape = func(game._filled, game._checkCollisions, game._BLOCK_WIDTH, game._BLOCK_HEIGHT, info.mode);
            if (!shape) throw new Error('No shape returned from shape function!', func);
            shape.init();
            result = shape;
          }
          else {
            shape = func(game._filled, game._checkCollisions, game._BLOCK_WIDTH, game._BLOCK_HEIGHT, info.mode);
            if (!shape) throw new Error('No shape returned from shape function!', func);
            shape.init();
            this.next = shape;
            if (_set_next_only) return null;
            result = next || this.nextShape();
          }

          if( game.options.autoplay ) { //fun little hack...
            game._niceShapes(game._filled, game._checkCollisions, game._BLOCK_WIDTH, game._BLOCK_HEIGHT, 'normal', result);
            result.orientation = result.best_orientation;
            result.x = result.best_x;
          }

          if( typeof game._theme.complexBlocks !== 'undefined' ) {
            if( $.isArray(game._theme.complexBlocks[result.blockType]) ) {
              result.blockVariation = game._randInt(0, game._theme.complexBlocks[result.blockType].length-1);
            } else {
              result.blockVariation = null;
            }
          }
          else if( typeof game._theme.blocks !== 'undefined' ) {
            if( $.isArray(game._theme.blocks[result.blockType]) ) {
              result.blockVariation = game._randInt(0, game._theme.blocks[result.blockType].length-1);
            } else {
              result.blockVariation = null;
            }
          }

          game.___updateNextShape(this.next)

          return result;
        },

        animate: function() {
          let drop = false
          let moved = false
          let gameOver = false
          let now = Date.now()

          if( this.animateTimeoutId ){ clearTimeout(this.animateTimeoutId); }

          if( !this.paused && !this.gameover ) {

            this.dropCount++;

            // Drop by delay or holding
            if( (this.dropCount >= this.dropDelay) ||
                (game.options.autoplay) ||
                (this.holding.drop && (now - this.holding.drop) >= this.holdingThreshold) ) {
              drop = true;
            moved = true;
              this.dropCount = 0;
            }

            // Move Left by holding
            if( this.holding.left && (now - this.holding.left) >= this.holdingThreshold ) {
              moved = true;
              this.cur.moveLeft();
            }

            // Move Right by holding
            if( this.holding.right && (now - this.holding.right) >= this.holdingThreshold ) {
              moved = true;
              this.cur.moveRight();
            }

            // Test for a collision, add the piece to the filled blocks and fetch the next one
            if (drop) {
              var cur = this.cur, x = cur.x, y = cur.y, blocks = cur.getBlocks();
              if (game._checkCollisions(x, y+1, blocks, true)) {
                drop = false;
                var blockIndex = 0;
                for (var i=0; i<cur.blocksLen; i+=2) {
                  game._filled.add(x + blocks[i], y + blocks[i+1], cur.blockType, cur.blockVariation, blockIndex, cur.orientation);
                  if (y + blocks[i] < 0) {
                    gameOver = true;
                  }
                  blockIndex++;
                }
                game._filled.checkForClears();
                this.cur = this.nextShape();
                this.renderChanged = true;

                // Stop holding drop (and any other buttons). Just in case the controls get sticky.
                this.holding.left = null;
                this.holding.right = null;
                this.holding.drop = null;

                game.options.onPlaced.call(game.element);
              }
            }
          }

          if (drop) {
            moved = true;
            this.cur.y++;
          }

          if( drop || moved ) {
            this.renderChanged = true;
          }

          if( gameOver ) {
            this.gameover = true;

            game.gameover();

            if( game.options.autoplay && game.options.autoplayRestart ) {
              // On autoplay, restart the game automatically
              game.restart();
            }
            this.renderChanged = true;
          } else {
            // Update the speed
            this.animateDelay = 1000 / game.options.speed;

            this.animateTimeoutId = window.setTimeout(function() {
              game._board.animate();
            }, this.animateDelay);
          }
        },

        createRandomBoard: function() {
          var start = [], blockTypes = [], i, ilen, j, jlen, blockType;

          // Draw a random blockrain screen
          blockTypes = Object.keys(game._shapeFactory);

          for (i=0, ilen=game._BLOCK_WIDTH; i<ilen; i++) {
            for (j=0, jlen=game._randChoice([game._randInt(0, 8), game._randInt(5, 9)]); j<jlen; j++) {
              if (!blockType || !game._randInt(0, 3)) blockType = game._randChoice(blockTypes);

              // Use a random piece and orientation
              // Todo: Use an actual random variation
              game._filled.add(i, game._BLOCK_HEIGHT - j, blockType, game._randInt(0,3), null, game._randInt(0,3));
            }
          }

          game._board.render(true);
        },

        render: function(forceRender) {
          if( this.renderChanged || forceRender ) {
            this.renderChanged = false;
            game._ctx.clearRect(0, 0, game._PIXEL_WIDTH, game._PIXEL_HEIGHT);
            game._drawBackground();
            game._filled.draw();
            this.cur.draw();
          }
        },

        /**
         * Draws one block (Each piece is made of 4 blocks)
         * The blockType is used to draw any block.
         * The falling attribute is needed to apply different styles for falling and placed blocks.
         */
        drawBlock: function(x, y, blockType, blockVariation, blockIndex, blockRotation, falling) {
          // convert x and y to pixel
          x = x * game._block_size;
          y = y * game._block_size;

          falling = typeof falling === 'boolean' ? falling : false;
          var borderWidth = game._theme.strokeWidth;
          var borderDistance = Math.round(game._block_size*0.2);
          var squareDistance = Math.round(game._block_size*0.3);

          var color = this.getBlockColor(blockType, blockVariation, blockIndex, falling);

          // Draw the main square
          game._ctx.globalAlpha = 1.0;

          // If it's an image, the block has a specific texture. Use that.
          if( color instanceof Image ) {
            game._ctx.globalAlpha = 1.0;
            // Not loaded
            if( color.width === 0 || color.height === 0 ){ return; }

            // A square is the same style for all blocks
            if( typeof game._theme.blocks !== 'undefined' && game._theme.blocks !== null ) {
              game._ctx.drawImage(color, 0, 0, color.width, color.height, x, y, game._block_size, game._block_size);
            }
            // A custom texture
            else if( typeof game._theme.complexBlocks !== 'undefined' && game._theme.complexBlocks !== null ) {
              if( typeof blockIndex === 'undefined' || blockIndex === null ){ blockIndex = 0; }

              var getCustomBlockImageCoordinates = function(image, blockType, blockIndex) {
                // The image is based on the first ("upright") orientation
                var positions = game._shapes[blockType][0];
                // Find the number of tiles it should have
                var minX = Math.min(positions[0], positions[2], positions[4], positions[6]);
                var maxX = Math.max(positions[0], positions[2], positions[4], positions[6]);
                var minY = Math.min(positions[1], positions[3], positions[5], positions[7]);
                var maxY = Math.max(positions[1], positions[3], positions[5], positions[7]);
                var rangeX = maxX - minX + 1;
                var rangeY = maxY - minY + 1;

                // X and Y sizes should match. Should.
                var tileSizeX = image.width / rangeX;
                var tileSizeY = image.height / rangeY;

                return {
                  x: tileSizeX * (positions[blockIndex*2]-minX),
                  y: tileSizeY * Math.abs(minY-positions[blockIndex*2+1]),
                  w: tileSizeX,
                  h: tileSizeY
                };
              };

              var coords = getCustomBlockImageCoordinates(color, blockType, blockIndex);

              game._ctx.save();

              game._ctx.translate(x, y);
              game._ctx.translate(game._block_size/2, game._block_size/2);
              game._ctx.rotate(-Math.PI/2 * blockRotation);
              game._ctx.drawImage(
                color,
                coords.x,
                coords.y,
                coords.w,
                coords.h,
                -game._block_size/2,
                -game._block_size/2,
                game._block_size,
                game._block_size
              );

              game._ctx.restore();
            } else {
              // ERROR
              game._ctx.fillStyle = '#ff0000';
              game._ctx.fillRect(x, y, game._block_size, game._block_size);
            }
          }
          else if( typeof color === 'string' )
          {
            game._ctx.fillStyle = color;
            game._ctx.fillRect(x, y, game._block_size, game._block_size);

            // Inner Shadow
            if( typeof game._theme.innerShadow === 'string' ) {
              game._ctx.globalAlpha = 1.0;
              game._ctx.strokeStyle = game._theme.innerShadow;
              game._ctx.lineWidth = 1.0;

              // Draw the borders
              game._ctx.strokeRect(x+1, y+1, game._block_size-2, game._block_size-2);
            }

            // Decoration (borders)
            if( typeof game._theme.stroke === 'string' ) {
              game._ctx.globalAlpha = 1.0;
              game._ctx.fillStyle = game._theme.stroke;
              game._ctx.strokeStyle = game._theme.stroke;
              game._ctx.lineWidth = borderWidth;

              // Draw the borders
              game._ctx.strokeRect(x, y, game._block_size, game._block_size);
            }
            if( typeof game._theme.innerStroke === 'string' ) {
              // Draw the inner dashes
              game._ctx.fillStyle = game._theme.innerStroke;
              game._ctx.fillRect(x+borderDistance, y+borderDistance, game._block_size-borderDistance*2, borderWidth);
              // The rects shouldn't overlap, to prevent issues with transparency
              game._ctx.fillRect(x+borderDistance, y+borderDistance+borderWidth, borderWidth, game._block_size-borderDistance*2-borderWidth);
            }
            if( typeof game._theme.innerSquare === 'string' ) {
              // Draw the inner square
              game._ctx.fillStyle = game._theme.innerSquare;
              game._ctx.globalAlpha = 0.2;
              game._ctx.fillRect(x+squareDistance, y+squareDistance, game._block_size-squareDistance*2, game._block_size-squareDistance*2);
            }
          }

          // Return the alpha back to 1.0 so we don't create any issues with other drawings.
          game._ctx.globalAlpha = 1.0;
        },

        getBlockColor: function(blockType, blockVariation, blockIndex, falling) {
          /**
           * The theme allows us to do many things:
           * - Use a specific color for the falling block (primary), regardless of the proper color.
           * - Use another color for the placed blocks (secondary).
           * - Default to the "original" block color in any of those cases by setting primary and/or secondary to null.
           * - With primary and secondary as null, all blocks keep their original colors.
           */

          var getBlockVariation = function(blockTheme, blockVariation) {
            if( $.isArray(blockTheme) ) {
              if( blockVariation !== null && typeof blockTheme[blockVariation] !== 'undefined' ) {
                return blockTheme[blockVariation];
              }
              else if(blockTheme.length > 0) {
                return blockTheme[0];
              } else {
                return null;
              }
            } else {
              return blockTheme;
            }
          }

          if( typeof falling !== 'boolean' ){ falling = true; }
          if( falling ) {
            if( typeof game._theme.primary === 'string' && game._theme.primary !== '' ) {
              return game._theme.primary;
            } else if( typeof game._theme.blocks !== 'undefined' && game._theme.blocks !== null ) {
              return getBlockVariation(game._theme.blocks[blockType], blockVariation);
            } else {
              return getBlockVariation(game._theme.complexBlocks[blockType], blockVariation);
            }
          } else {
            if( typeof game._theme.secondary === 'string' && game._theme.secondary !== '' ) {
              return game._theme.secondary;
            } else if( typeof game._theme.blocks !== 'undefined' && game._theme.blocks !== null ) {
              return getBlockVariation(game._theme.blocks[blockType], blockVariation);
            } else {
              return getBlockVariation(game._theme.complexBlocks[blockType], blockVariation);
            }
          }
        }

      };

      game._niceShapes = game._getNiceShapes();
    },

    /**
     * Find base64 encoded images and load them as image objects, which can be used by the canvas renderer
     */
    _preloadThemeAssets: function() {

      var game = this;

      var hexColorcheck = new RegExp('^#[A-F0-9+]{3,6}', 'i');
      var base64check = new RegExp('^data:image/(png|gif|jpg);base64,', 'i');

      var handleAssetLoad = function() {
        // Rerender the board as soon as an asset loads
        if( game._board ) {
          game._board.render(true);
        }
      };

      var loadAsset = function(src) {
        var plainSrc = src;
        if( ! hexColorcheck.test( plainSrc ) ) {
          // It's an image
          src = new Image();
          src.src = plainSrc;
          src.onload = handleAssetLoad;
        } else {
          // It's a color
          src = plainSrc;
        }
        return src;
      };

      var startAssetLoad = function(block) {
        // Assets can be an array of variation so they can change color/design randomly
        if( $.isArray(block) && block.length > 0 ) {
          for( var i=0; i<block.length; i++ ) {
            block[i] = loadAsset(block[i]);
          }
        }
        else if( typeof block === 'string' ) {
          block = loadAsset(block);
        }
        return block;
      };


      if( typeof this._theme.complexBlocks !== 'undefined' ){
        var keys = Object.keys(this._theme.complexBlocks);

        // Load the complexBlocks
        for( var i = 0; i < keys.length; i++ ) {
          this._theme.complexBlocks[ keys[i] ] = startAssetLoad( this._theme.complexBlocks[ keys[i] ] );
        }
      }
      else if( typeof this._theme.blocks !== 'undefined' ){
        var keys = Object.keys(this._theme.blocks);

        // Load the blocks
        for( var i = 0; i < keys.length; i++ ) {
          this._theme.blocks[ keys[i] ] = startAssetLoad( this._theme.blocks[ keys[i] ] );
        }
      }

      // Load the bg
      if( typeof this._theme.backgroundGrid !== 'undefined' ){
        if( typeof this._theme.backgroundGrid === 'string' ) {
          if( ! hexColorcheck.test( this._theme.backgroundGrid ) ) {
            var src = this._theme.backgroundGrid;
            this._theme.backgroundGrid = new Image();
            this._theme.backgroundGrid.src = src;
            this._theme.backgroundGrid.onload = handleAssetLoad;
          }
        }
      }

    },

    _createHolder: function() {
      // Create the main holder (it holds all the ui elements, the original element is just the wrapper)
      this._$gameholder = $('<div class="blockrain-game-holder"></div>');
      this._$gameholder.css('position', 'relative').css('width', '100%').css('height', '100%');

      this.element.html('').append(this._$gameholder);

      // Create the game canvas and context
      this._$canvas = $('<canvas class="game_canvas"style="display:block; width:100%; height:100%; padding:0; margin:0; border:none;" />');
      if( typeof this._theme.background === 'string' ) {
        this._$canvas.css('background-color', this._theme.background);
      }

      this._$gameholder.append(this._$canvas)

      this._canvas = this._$canvas.get(0);
      this._ctx = this._canvas.getContext('2d');
    },

    _createUI: function() {
      var game = this;

      // Create the start menu
      game.___$startMessageStatic = $(`
        <section class="message">
          ${this.options.startTextStatic}
        </section>
      `).hide();

      game.___$startMessage = $(`
        <section class="message">
          ${this.options.startText}
        </section>
      `).hide();

      // Create the game over menu
      game.___$gameover = $(`
        <section class="message message__game_over">
          ${this.options.gameOverText}
        </section>
      `).hide();

      this.___vanHeight = this._$canvas[0].clientHeight * 0.75
      const vans = $(`
        <div class="vans">
          <img
            class="van van--hidden"
            style="height: ${this.___vanHeight}px; width: ${this.___vanHeight * 1.5}px;"
            src="assets/images/van.png"
          />
          <img
            class="van van--parked"
            style="height: ${this.___vanHeight}px; width: ${this.___vanHeight * 1.5}px;"
            src="assets/images/van.png"
          />
        </div`
      )

      game.___$saucer = $(`
        <img
          class="saucer"
          style="height: ${this.___vanHeight}px; width: ${this.___vanHeight * 1.5}px;"
          src="assets/images/van.png"
        />
      `)

      game._$gameholder.append(
        game.___$startMessageStatic,
        game.___$startMessage,
        game.___$gameover,
        game.___$saucer,
      )
      $(`.container__inner`).append(vans)

      const sidebar = $(`
        <aside class="sidebar">
          <section class="score">
            <p class="score__title">Score</p>
            <p class="score__counter">0</p>
          </section>
          <section class="blown_lines">
            <p class="blown_lines__title">Lines<p>
            <p class="blown_lines__counter">
              0
            <p>
          </section>
          <section class="next_shape">
            <img class="next_shape__preview"/>
          </section>
          <section class="score_top">
            <p class="score_top__title">10 best scores</p>
            <ul></ul>
          </section>
        </aside>
      `)

      const timer = $(`
        <section class="timer">
          <p class="timer__title">Time Limit</p>
          <p class="timer__countdown">None</p>
        </section>
      `)

      const logo = $(`
        <section class="logo">
          <h1>Brenger</h1>
        </section>
      `)

      game.___$scoreboard = sidebar.find(`.score_top`)
      game.___$scoreCounter = sidebar.find(`.score__counter`)
      game.___$timer = timer.find(`.timer__countdown`)
      game.___$nextShapeImage = sidebar.find(`.next_shape__preview`)

      $(`.game`).append(sidebar, timer, logo)

      if (this.options.timeLimit) {
        game.___updateTimer(this.options.timeLimit)
      }

      this._createControls();
    },

    _createControls: function() {

      var game = this;

      game._$touchLeft = $('<a class="blockrain-touch blockrain-touch-left" />').appendTo(game._$gameholder);
      game._$touchRight = $('<a class="blockrain-touch blockrain-touch-right" />').appendTo(game._$gameholder);
      game._$touchRotateRight = $('<a class="blockrain-touch blockrain-touch-rotate-right" />').appendTo(game._$gameholder);
      game._$touchRotateLeft = $('<a class="blockrain-touch blockrain-touch-rotate-left" />').appendTo(game._$gameholder);
      game._$touchDrop = $('<a class="blockrain-touch blockrain-touch-drop" />').appendTo(game._$gameholder);

    },

    _refreshBlockSizes: function() {

      if( this.options.autoBlockWidth ) {
        this.options.blockWidth = Math.ceil( this.element.width() / this.options.autoBlockSize );
      }

    },

    _getNiceShapes: function() {
      /*
       * Things I need for this to work...
       *  - ability to test each shape with this._filled data
       *  - maybe give empty spots scores? and try to maximize the score?
       */

      var game = this;

      var shapes = {},
          attr;

      for( var attr in this._shapeFactory ) {
        shapes[attr] = this._shapeFactory[attr]();
      }

      function scoreBlocks(possibles, blocks, x, y, filled, width, height) {
        var i, len=blocks.length, score=0, bottoms = {}, tx, ty, overlaps;

        // base score
        for (i=0; i<len; i+=2) {
          score += possibles[game._filled.asIndex(x + blocks[i], y + blocks[i+1])] || 0;
        }

        // overlap score -- //TODO - don't count overlaps if cleared?
        for (i=0; i<len; i+=2) {
          tx = blocks[i];
          ty = blocks[i+1];
          if (bottoms[tx] === undefined || bottoms[tx] < ty) {
            bottoms[tx] = ty;
          }
        }
        overlaps = 0;
        for (tx in bottoms) {
          tx = parseInt(tx);
          for (ty=bottoms[tx]+1, i=0; y+ty<height; ty++, i++) {
            if (!game._filled.check(x + tx, y + ty)) {
              overlaps += i == 0 ? 2 : 1; //TODO-score better
              //if (i == 0) overlaps += 1;
              break;
            }
          }
        }

        score = score - overlaps;

        return score;
      }

      function resetShapes() {
        for (var attr in shapes) {
          shapes[attr].x = 0;
          shapes[attr].y = -1;
        }
      }

      //TODO -- evil mode needs to realize that overlap is bad...
      var func = function(filled, checkCollisions, width, height, mode, _one_shape) {
        if (!_one_shape) resetShapes();

        var possibles = new Array(width * height),
            evil = mode == 'evil',
            x, y, py,
            attr, shape, i, blocks, bounds,
            score, best_shape, best_score = (evil ? 1 : -1) * 999, best_orientation, best_x,
            best_score_for_shape, best_orientation_for_shape, best_x_for_shape;

        for (x=0; x<width; x++) {
          for (y=0; y<=height; y++) {
            if (y == height || filled.check(x, y)) {
              for (py=y-4; py<y; py++) {
                possibles[filled.asIndex(x, py)] = py; //TODO - figure out better scoring?
              }
              break;
            }
          }
        }

        // for each shape...
        var opts = _one_shape === undefined ? shapes : {cur: _one_shape}; //BOO
        for (attr in opts) { //TODO - check in random order to prevent later shapes from winning
          shape = opts[attr];
          best_score_for_shape = -999;

          // for each orientation...
          for (i=0; i<(shape.symmetrical ? 2 : 4); i++) { //TODO - only look at unique orientations
            blocks = shape.getBlocks(i);
            bounds = shape.getBounds(blocks);

            // try each possible position...
            for (x=-bounds.left; x<width - bounds.width; x++) {
              for (y=-1; y<height - bounds.bottom; y++) {
                if( game._checkCollisions(x, y + 1, blocks, true) ) {
                  // collision
                  score = scoreBlocks(possibles, blocks, x, y, filled, width, height);
                  if (score > best_score_for_shape) {
                    best_score_for_shape = score;
                    best_orientation_for_shape = i;
                    best_x_for_shape = x;
                  }
                  break;
                }
              }
            }
          }

          if ((evil && best_score_for_shape < best_score) ||
              (!evil && best_score_for_shape > best_score)) {
            best_shape = shape;
            best_score = best_score_for_shape;
            best_orientation = best_orientation_for_shape;
            best_x = best_x_for_shape;
          }
        }

        best_shape.best_orientation = best_orientation;
        best_shape.best_x = best_x;

        return best_shape;
      };

      func.no_preview = true;
      return func;
    },

    _randomShapes: function() {
      // Todo: The shapefuncs should be cached.
      var shapeFuncs = [];
      $.each(this._shapeFactory, function(k,v) { shapeFuncs.push(v); });

      return this._randChoice(shapeFuncs);
    },

    /**
     * Controls
     */
    _setupControls: function(enable) {

      var game = this;

      var moveLeft = function(start) {
        if( ! start ) { game._board.holding.left = null; return; }
        if( ! game._board.holding.left ) {
          game._board.cur.moveLeft();
          game._board.holding.left = Date.now();
          game._board.holding.right = null;
        }
      }
      var moveRight = function(start) {
        if( ! start ) { game._board.holding.right = null; return; }
        if( ! game._board.holding.right ) {
          game._board.cur.moveRight();
          game._board.holding.right = Date.now();
          game._board.holding.left = null;
        }
      }
      var drop = function(start) {
        if( ! start ) { game._board.holding.drop = null; return; }
        if( ! game._board.holding.drop ) {
          game._board.cur.drop();
          game._board.holding.drop = Date.now();
        }
      }
      var rotateLeft = function() {
        game._board.cur.rotate('left');
      }
      var rotateRight = function() {
        game._board.cur.rotate('right');
      }

      // Handlers: These are used to be able to bind/unbind controls
      var handleKeyDown = function(evt) {
        if( ! game._board.cur ) { return true; }
        var caught = false;

        caught = true;
        if (game.options.asdwKeys) {
          switch(evt.keyCode) {
            case 65: /*a*/    moveLeft(true); break;
            case 68: /*d*/    moveRight(true); break;
            case 83: /*s*/    drop(true); break;
            case 87: /*w*/    game._board.cur.rotate('right'); break;
          }
        }
        switch(evt.keyCode) {
          case 37: /*left*/   moveLeft(true); break;
          case 39: /*right*/  moveRight(true); break;
          case 40: /*down*/   drop(true); break;
          case 38: /*up*/     game._board.cur.rotate('right'); break;
          case 88: /*x*/      game._board.cur.rotate('right'); break;
          case 90: /*z*/      game._board.cur.rotate('left'); break;
          default: caught = false;
        }
        if (caught) evt.preventDefault();
        return !caught;
      };


      var handleKeyUp = function(evt) {
        if( ! game._board.cur ) { return true; }
        var caught = false;

        caught = true;
        if (game.options.asdwKeys) {
          switch(evt.keyCode) {
            case 65: /*a*/    moveLeft(false); break;
            case 68: /*d*/    moveRight(false); break;
            case 83: /*s*/    drop(false); break;
          }
        }
        switch(evt.keyCode) {
          case 37: /*left*/   moveLeft(false); break;
          case 39: /*right*/  moveRight(false); break;
          case 40: /*down*/   drop(false); break;
          default: caught = false;
        }
        if (caught) evt.preventDefault();
        return !caught;
      };

      function isStopKey(evt) {
        var cfg = {
          stopKeys: {37:1, 38:1, 39:1, 40:1}
        };

        var isStop = (cfg.stopKeys[evt.keyCode] || (cfg.moreStopKeys && cfg.moreStopKeys[evt.keyCode]));
        if (isStop) evt.preventDefault();
        return isStop;
      }

      function getKey(evt) { return 'safekeypress.' + evt.keyCode; }

      function keydown(evt) {
        var key = getKey(evt);
        $.data(this, key, ($.data(this, key) || 0) - 1);
        return handleKeyDown.call(this, evt);
      }

      function keyup(evt) {
        $.data(this, getKey(evt), 0);
        handleKeyUp.call(this, evt);
        return isStopKey(evt);
      }

      // Unbind everything by default
      // Use event namespacing so we don't ruin other keypress events
      $(document) .unbind('keydown.blockrain')
                  .unbind('keyup.blockrain');

      if( ! game.options.autoplay ) {
        if( enable ) {
          $(document)
            .bind('keydown.blockrain', keydown)
            .bind('keyup.blockrain', keyup);
        }
      }
    },

    _setupTouchControls: function(enable) {

      var game = this;

      // Movements can be held for faster movement
      var moveLeft = function(event){
        event.preventDefault();
        game._board.cur.moveLeft();
        game._board.holding.left = Date.now();
        game._board.holding.right = null;
        game._board.holding.drop = null;
      };
      var moveRight = function(event){
        event.preventDefault();
        game._board.cur.moveRight();
        game._board.holding.right = Date.now();
        game._board.holding.left = null;
        game._board.holding.drop = null;
      };
      var drop = function(event){
        event.preventDefault();
        game._board.cur.drop();
        game._board.holding.drop = Date.now();
      };
      var endMoveLeft = function(event){
        event.preventDefault();
        game._board.holding.left = null;
      };
      var endMoveRight = function(event){
        event.preventDefault();
        game._board.holding.right = null;
      };
      var endDrop = function(event){
        event.preventDefault();
        game._board.holding.drop = null;
      };

      // Rotations can't be held
      var rotateLeft = function(event){
        event.preventDefault();
        game._board.cur.rotate('left');
      };
      var rotateRight = function(event){
        event.preventDefault();
        game._board.cur.rotate('right');
      };

      // Unbind everything by default
      game._$touchLeft.unbind('touchstart touchend click');
      game._$touchRight.unbind('touchstart touchend click');
      game._$touchRotateLeft.unbind('touchstart touchend click');
      game._$touchRotateRight.unbind('touchstart touchend click');
      game._$touchDrop.unbind('touchstart touchend click');

      if( ! game.options.autoplay && enable ) {
        game._$touchLeft.show().bind('touchstart click', moveLeft).bind('touchend', endMoveLeft);
        game._$touchRight.show().bind('touchstart click', moveRight).bind('touchend', endMoveRight);
        game._$touchDrop.show().bind('touchstart click', drop).bind('touchend', endDrop);
        game._$touchRotateLeft.show().bind('touchstart click', rotateLeft);
        game._$touchRotateRight.show().bind('touchstart click', rotateRight);
      } else {
        game._$touchLeft.hide();
        game._$touchRight.hide();
        game._$touchRotateLeft.hide();
        game._$touchRotateRight.hide();
        game._$touchDrop.hide();
      }

    },

    // Utility Functions
    _randInt: function(a, b) {
      return a + Math.floor(Math.random() * (1 + b - a));
    },
    _randSign: function() {
      return this._randInt(0, 1) * 2 - 1;
    },
    _randChoice: function(choices) {
      return choices[this._randInt(0, choices.length-1)];
    },
  });
})(jQuery));
