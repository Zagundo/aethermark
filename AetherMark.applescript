-- Compiled into a self-contained app by scripts/build_macos_app.py.
on launchAetherMark(theFiles)
    set resourceDir to (POSIX path of (path to me)) & "Contents/Resources/aethermark/"
    set commandText to "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin python3 " & quoted form of (resourceDir & "launch.py")
    repeat with aFile in theFiles
        set commandText to commandText & " " & quoted form of (POSIX path of aFile)
    end repeat
    try
        do shell script commandText
    on error errorText
        display dialog errorText with title "AetherMark" buttons {"OK"} default button "OK" with icon caution
    end try
end launchAetherMark

on open theFiles
    launchAetherMark(theFiles)
end open

on run
    launchAetherMark({})
end run
