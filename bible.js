#!/usr/bin/env node

// Dependencies
var BibleJS = require("bible.js")
  , Couleurs = require("couleurs")()
  , Debug = require("bug-killer")
  , RegexParser = require("regex-parser")
  , Ul = require("ul")
  , Yargs = require("yargs")
  , OS = require("os")
  , LeTable = require("le-table")
  , Fs = require("fs")
  , config = null
  ;

// Help output
const HELP = require("./docs/help")
    , SAMPLE_CONFIGURATION = require("./docs/sample-conf")
    , CONFIG_FILE_PATH = Ul.USER_DIR + "/.bible-config.json"
    , SUBMODULES_DIR = Ul.USER_DIR + "/.bible"
    ;

// CLI args parser
Yargs = Yargs.usage(HELP);
var Argv = Yargs.argv
  , language = Argv.lang || Argv.language
  , search = Argv.s || Argv.search
  , searchResultColor = null
  ;

// Set log level
Debug.config.logLevel = 3;

// Read the configuration file
try {
    config = require(CONFIG_FILE_PATH);
} catch (e) {
    if (e.code === "MODULE_NOT_FOUND") {
        Debug.log(
            "No configuration file was found. Initing the configuration file."
          , "warn"
        );
        Fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(
            SAMPLE_CONFIGURATION, null, 4
        ));
        Debug.log(
            "The configuration file created successfully at the following location: "
          + CONFIG_FILE_PATH
          , "warn"
        );
        config = require(CONFIG_FILE_PATH);
    } else {
        Debug.log(
            "Cannot read the configuration file. Reason: " + e.code
          , "warn"
        );
    }
}

// Show the version
if (Argv.v || Argv.version) {
    return console.log(
        "Bible " + require("./package").version
    + "\nBible.JS " + require("./package").dependencies["bible.js"]
    );
}

// Show help
var references = Argv._;
if (Argv.help ||  (!language && !references.length && !search)) {
    return console.log(Yargs.help());
}

// Try to get options from config as well
language = language || config.language;
searchResultColor = (
    Argv.rc || Argv.resultColor || config.resultColor
).split(/[ ,]+/)
config.searchLimit = config.searchLimit || 10;

// Table defaults
LeTable.defaults.marks = {
    nw: "┌"
  , n:  "─"
  , ne: "┐"
  , e:  "│"
  , se: "┘"
  , s:  "─"
  , sw: "└"
  , w:  "│"
  , b: " "
  , mt: "┬"
  , ml: "├"
  , mr: "┤"
  , mb: "┴"
  , mm: "┼"
};

// Parse result color
for (var i = 0; i < 3; ++i) {

    if (!searchResultColor[i]) {
        return console.log(
            "Invalid result color. Please provide a string in this format:"
          + "'r, g, b'. Example: --resultColor '255, 0, 0'"
        );
    }

    searchResultColor[i] = parseInt(searchResultColor[i])
}


/**
 * printOutput
 * This function is called when the response from the
 * search or get request comes
 *
 * @param {Error} err An error that ocured while fetching the verses.
 * @param {Array} verses The verses array that was returned by bible.js module.
 * @return {undefined} Returns undefined
 */
function printOutput (err, verses) {

    // Handle error
    if (err) {
        console.log("Error: ", err);
        return;
    }

    // No verses
    if (!verses || !verses.length) {
        console.log("Verses not found");
    }

    var tbl = new LeTable();

    // Output each verse
    for (var i in verses) {

        // get the current verse and its reference
        var cVerse = verses[i]
          , cVerseRef = cVerse.bookname + " " + cVerse.chapter + ":" + cVerse.verse
          ;

        if (search) {

            // Highlight search results
            var re = typeof search === "string" ? RegexParser(search) : search
              , match = cVerse.text.match(re) || []
              ;

            for (var ii = 0; ii < match.length; ++ii) {
                cVerse.text = cVerse.text.replace (
                    new RegExp(match[ii])
                  , Couleurs.fg(match[ii], searchResultColor)
                );
            }
        }

        if (Argv.onlyVerses) {
            console.log(cVerse.text);
        } else {
            tbl.addRow([
                {text: cVerseRef, data: {hAlign: "right"}}
              , {
                    text: cVerse.text.match(/.{1,80}(\s|$)|\S+?(\s|$)/g).join("\n")
                  , data: {hAlign: "left"}
                }
            ]);
        }

        // Search limit
        if (search && --config.searchLimit <= 0) {
            break;
        }
    }

    // Output
    if (!Argv.onlyVerses) {
        console.log(tbl.toString());
    }
}

// Check if the ~/.bible dir exists
if (!Fs.existsSync(SUBMODULES_DIR)) {
    Debug.log("~/.bible directory was not found. Downloading packages. This may take a while.", "info");
}

// Init submodules
BibleJS.init(config, function (err) {

    if (err) { throw err; }

    // Create Bible instance
    var bibleIns = new BibleJS({language: language});

    // Get the verses
    if (references.length) {
        for (var i = 0; i < references.length; ++i) {
            (function (cR) {
                if (!Argv.onlyVerses) {
                    console.log("Reference: " + cR);
                }
                bibleIns.get(cR, printOutput);
            })(references[i]);
        }
    }

    // Search verses
    if (search) {
        if (!Argv.onlyVerses) {
            console.log("Results for search: " + search);
        }
        bibleIns.search(search, printOutput);
    }
});
