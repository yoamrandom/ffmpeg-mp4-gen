const $ = id => document.getElementById(id);
let progress = $('progress');
let c = $('canvas');
let ctx = c.getContext('2d', {alpha: false});
let TYPE, W, H, FPS, BUFF;

let images = []

const worker = new Worker('ffmpeg-worker-mp4.js');

$("imgs").addEventListener("change",  function() {
    BUFF = false;
}, false);
    

$("gen-btn").addEventListener("click", start);


function start() {
    if(typeof BUFF == "undefined")return;

    let f = $("imgs").files;
    W = $('w').value, H = $('h').value, FPS = $('fps').value;
    TYPE = f[0].type.match(/\/([a-z]+)/)[1];

    let v = $('vid');
    c.width = W, c.height = H, v.width = W, v.height = H; 

    progress.max = f.length;
    
    if(BUFF){
        $('status').innerHTML = "Compiling Video";
        finalizeVideo();
    } else {
        c.style.display = "";
        progress.value = 0;
        $('images').innerHTML = "";
        $('ffmsg').innerText = "";
        v.src = "";
        images = [];
        $('status').innerHTML = "Drawing Frames";
        nextFrame(f);
    }
}

function pad(n, width, z) {
z = z || '0';
n = n + '';
return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function nextFrame(fl){
    let file = fl[progress.value];
    progress.value++;
    const reader = new FileReader();
    reader.onload = async (e) => {
        await resz(e.target.result);
        const img = new Image(), type = file.type;
        const imgString = c.toDataURL(type, 1)
        const data = convertDataURIToBinary( imgString )
        console.log(TYPE+" ::Image", data);
        
        images.push({
            name: `img${ pad( images.length, 3 ) }.${TYPE}`,
            data
        })
        console.log(progress.value);
        img.src = imgString;
        $('images').appendChild(img);
    
        if(progress.value / progress.max < 1){
            setTimeout(() => { nextFrame(fl) });
            $('status').innerHTML = "Drawing Frames";
        }else{
            BUFF = true;
            $('status').innerHTML = "Compiling Video";
            setTimeout(finalizeVideo);
        }
    };
    reader.readAsDataURL(file);

}
function convertDataURIToBinary(dataURI) {
    let base64 = dataURI.replace(/^data[^,]+,/,'');
    let raw = window.atob(base64);
    let rawLength = raw.length;

    let array = new Uint8Array(new ArrayBuffer(rawLength));
    for (i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
};

function blobToDataURL(blob, callback) {
    let a = new FileReader();
    a.onload = function(e) {callback(e.target.result);}
    a.readAsDataURL(blob);
}

let start_time

function finalizeVideo(){
    c.style.display = "none";
    start_time = +new Date;

    const msgs = $('ffmsg')

    let messages = '';

    worker.onmessage = function(e) {
        let msg = e.data;
        switch (msg.type) {
            case "stdout":
            case "stderr":
                messages = msg.data + "\n" + messages;
                break;
            case "exit":
                console.log("Process exited with code " + msg.data);
                break;

            case 'done':
                const blob = new Blob([msg.data.MEMFS[0].data], {
                    type: "video/mp4"
                });
                done( blob )

            break;
        }
        msgs.innerHTML = messages
    };

    worker.postMessage({
        type: 'run',
        TOTAL_MEMORY: 268435456,
        arguments: [
            "-r", ""+ FPS,
            "-i", "img%03d." + TYPE,
            "-c:v", "libx264",
            "-crf", "17",
            "-vf", `scale=${W}:${H}`,
            "-pix_fmt", "yuv420p",
            "-vb", "500M",
            "-preset", "ultrafast",
            "-an",
            "out.mp4"
        ],
        MEMFS: images
    });
    console.log(W, H, TYPE);
    
    // Updated recommented arguments
    /*
            worker.postMessage({
            type: 'run',
            TOTAL_MEMORY: 268435456,
            arguments: [
                //"-r", opts.state.frameRate.toString(),
                "-framerate", opts.state.frameRate.toString(),
                "-frames:v", imgs.length.toString(),
                "-an", // disable sound
                "-i", "img%03d.jpeg",
                "-c:v", "libx264",
                "-crf", "17", // https://trac.ffmpeg.org/wiki/Encode/H.264
                "-filter:v",
                `scale=${w}:${h}`,
                "-pix_fmt", "yuv420p",
                "-b:v", "20M",
                "out.mp4"],
            MEMFS: imgs
        });*/

    /*video.compile(false, function(output){
        $('vid').src = url; //toString converts it to a URL via Object URLs, falling back to DataURL
        $('download').style.display = '';
        $('download').href = url;
    });*/
}

function done(output) {

    const url = webkitURL.createObjectURL(output);

    let end_time = +new Date;
    $('status').innerHTML = "Compiled Video in " + (end_time - start_time) + "ms, file size: " + Math.ceil(output.size / 1024) + "KB";
    $('vid').src = url; //toString converts it to a URL via Object URLs, falling back to DataURL
    $('download').style.display = '';
    $('download').href = url;
}



async function resz(src){
    let img = await new Promise(p => {
        let i = new Image(W, H);
        i.onload = () => { p(i) };
        i.src = src;
    })
    
    ctx.drawImage(img, 0, 0, W, H);
}