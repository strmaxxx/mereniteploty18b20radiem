namespace mereniTeploty18b20Radiem{

    // Další ikonky zde: https://fontawesome.com/v5/search?o=r&m=free

    /**
     * Každých t_mereni ms (100 ms) změří hodnotu z teploměru a filtruje ji dolnopropustným filtrem.
     * Každých t_pause/5 ms (200 ms) ukládá aktuální hodnotu do bufferu, který obsahuje 5 hodnot.
     * Každých t_pause ms (1000 ms) odešle buffer s popisem hodnot rádiem.
     * Rádiem lze odeslat maximálně 19 bajtů. 5 čísel = 10 bajtů + 9 bajtů na popis hodnoty ASCII znaky
     */

    const pocet_cisel = 5;
    const t_pause = 1000;
    const t_mereni = 100;
    const koef_zaokrouhleni = 10; // 10 = desetiny, 100 = setiny atd.

    //% block="Spustí měření a odesílání dat, skupina_rádia: %radioGroup, Hodnota k zobrazení: %typ_hodnoty, pin, kde je připojený teploměr: %vstupni_pin, popis_hodnoty (Maximálně 9 ASCII znaků): %popis_hodnoty"
    export function spustOdesilatele(radioGroup: number, typ_hodnoty: DS18B20.ValType, vstupni_pin: DigitalPin, popis_hodnoty: string) {

        let prubezna_hodnota = 0;
        let hodnota_k_odeslani = 0;

        radio.setGroup(radioGroup);

        control.inBackground(function () {

            while (true) {

                let hodnota = DS18B20.Ds18b20Temp(typ_hodnoty, vstupni_pin);

                // volba filtru
                if (true) {

                    prubezna_hodnota = prubezna_hodnota * 0.9 + hodnota * 0.1;
                    hodnota_k_odeslani = prubezna_hodnota;
                } else {

                    prubezna_hodnota += (hodnota - prubezna_hodnota) / 10;
                    hodnota_k_odeslani = prubezna_hodnota;
                }
                pause(t_mereni);
            }
        });

        let buffer: any[] = [];
        let buffer_index = 0;
        for (let i = 0; i < pocet_cisel; i++) buffer.push(0);

        control.inBackground(function () {
            while (true) {

                buffer[buffer_index] = Math.round(hodnota_k_odeslani * koef_zaokrouhleni);
                if (buffer_index < pocet_cisel) buffer_index++;
                else buffer.shift();

                pause(t_pause / pocet_cisel);
            }
        })

        control.inBackground(function () {
            while (true) {

                let buf = pins.createBuffer(pocet_cisel * 2 + popis_hodnoty.length)

                for (let j = 0; j < pocet_cisel; j++) {

                    buf.setNumber(NumberFormat.Int16LE, j * 2, buffer[j])
                }

                for (let k = 0; k < popis_hodnoty.length; k++) {

                    buf.setNumber(NumberFormat.Int8LE, pocet_cisel * 2 + k, popis_hodnoty.charCodeAt(k));
                }

                radio.sendBuffer(buf);
                pause(t_pause);
            }
        })

    }

    //% block="Spustí příjemce dat. skupina_rádia: %radioGroup"
    export function spustPrijemce(radioGroup: number) {

        let prijato = false;

        radio.onReceivedBuffer(function (receivedBuffer) {

            let popis = '';
            for (let l = pocet_cisel * 2; l < receivedBuffer.length; l++) {

                popis += String.fromCharCode(receivedBuffer.getNumber(NumberFormat.Int8LE, l));
            }
            for (let m = 0; m < pocet_cisel; m++) {

                serial.writeLine(popis + ':' + receivedBuffer.getNumber(NumberFormat.Int16LE, m * 2) / koef_zaokrouhleni);
                pause(t_pause / 10 - 1);
            }

            prijato = true;
        });

        radio.setGroup(radioGroup)
        serial.redirectToUSB()

        control.runInParallel(function () {

            while (true) {

                if (prijato) {

                    led.plot(0, 0)
                    pause(100);
                    prijato = false;
                } else {

                    led.unplot(0, 0);
                    pause(100);
                }
            }

        });
    }

}
