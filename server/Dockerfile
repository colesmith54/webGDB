FROM gcc:latest

RUN apt-get update && \
    apt-get install -y gdb

WORKDIR /code

CMD ["tail", "-f", "/dev/null"]
